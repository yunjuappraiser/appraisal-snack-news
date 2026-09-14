
import fs from "node:fs/promises";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error("OPENAI_API_KEY secret이 없습니다.");
}

const DATA_PATH = "data/news.json";

const existing = JSON.parse(
  await fs.readFile(DATA_PATH, "utf8")
);

const previousSnacks = existing.snacks || [];

/*
 * 최근 8개만 모델에게 전달한다.
 * 중복 검증 자체는 코드에서 수행하므로
 * 모델에게 20개 전체를 보여줄 필요가 없다.
 */
const recentSnacks = previousSnacks.slice(0, 8);

const recentHistory = recentSnacks
  .map(
    (x, i) =>
      `${i + 1}. ${x.title || ""} | ${x.key || ""}`
  )
  .join("\n");

const recentUrls = recentSnacks
  .map(x => x.source_url)
  .filter(Boolean);


/*
 * URL을 기사 식별용 문자열로 변환한다.
 *
 * 예:
 * korea.kr/...newsId=123
 * admin.korea.kr/...newsId=123
 *
 * → newsId=123
 *
 * 같은 기사가 도메인만 달라지는 경우를
 * 중복으로 잡기 위한 장치다.
 */
function getUrlFingerprint(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    const importantParams = [
      ...parsed.searchParams.entries()
    ]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([key]) =>
        /id|news|article|articleid|newsid|no|idx|seq/i.test(
          key
        )
      );

    if (importantParams.length > 0) {
      return importantParams
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
    }

    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const recentFingerprints = recentUrls
  .map(getUrlFingerprint)
  .filter(Boolean);


/*
 * 한국 날짜
 */
const today = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
})
  .format(new Date())
  .replaceAll(". ", ".")
  .replace(/\.$/, "");


/*
 * 핵심 프롬프트
 *
 * 이전 버전보다 훨씬 짧게 만들었다.
 */
const prompt = `
오늘은 ${today}.

너는 '감정평가 데일리 스낵'의 편집자다.
감정평가 공부 약 6개월 차 수험생이 읽을 최신 뉴스 1개를 골라 분석한다.

[목표]
단순 뉴스 요약이 아니라,
"뉴스에서 무엇이 변했고 → 어떤 가격결정 변수가 움직이며 → 부동산 가치에 어떤 경로로 영향을 주는가"
를 보여준다.

[뉴스]
웹 검색으로 최근 실제 한국 뉴스를 확인한다.
부동산·토지·주택·정비사업·보상·공시지가·도시계획·교통·금리·금융·세금·판례·정책·개발사업·인프라 등에서 선택한다.

단순 집값 등락보다 다음과 같은 변화가 드러나는 뉴스를 선호한다:
개발가능성, 최유효이용, 용도지역, 인허가, 사업기간, 개발비용, 금융비용, 금리, 임대료, 수익률, 위험, 권리관계, 교통접근성, 공급·수요, 보상기준.

[분석]
뉴스 사실 → 변화한 조건 → 가격결정 변수 → 가치에 미치는 영향
순서로 설명한다.

가능하면 상승요인과 반대요인을 함께 보여준다.
예: 개발가능성↑ → 예상 잔여이익↑ → 가치↑
하지만 사업기간·비용·위험↑ → 현재가치↓.

교과서적인 문장은 피한다.
"감정평가에서 중요하다", "수요와 공급이 중요하다" 같은 당연한 설명은 하지 않는다.

[수험생 수준]
최유효이용, 거래사례비교법, 원가법, 수익환원법, 개발법, 자본환원율, 할인율, 개발이익 등의 기본 개념은 알고 있다고 가정한다.
전문용어를 늘어놓기보다 실제 뉴스와 변수의 관계를 깊게 보여준다.

[중복]
아래 최근 스낵과 동일한 사건·정책·발표·기사를 선택하지 않는다.
제목만 바꾼 재활용도 금지한다.

${recentHistory}

[출처]
실제 웹 검색으로 확인한 기사 또는 공식 발표 URL 하나를 넣는다.
URL을 추측하지 않는다.

[출력]
title은 "왜?"라는 궁금증을 만들되 낚시성 표현은 피한다.
body는 4~6문장.
key는 가격결정 변수의 관계를 한 문장으로 쓴다.

JSON만 반환한다.
`;


/*
 * JSON Schema
 */
const schema = {
  type: "object",
  properties: {
    date: { type: "string" },
    tag: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    key: { type: "string" },
    source_url: { type: "string" }
  },
  required: [
    "date",
    "tag",
    "title",
    "body",
    "key",
    "source_url"
  ],
  additionalProperties: false
};


/*
 * OpenAI API 호출
 *
 * 429가 발생하면 자동으로 재시도한다.
 */
async function requestOpenAI() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          store: false,

          tools: [
            {
              type: "web_search"
            }
          ],

          input: prompt,

          text: {
            format: {
              type: "json_schema",
              name: "daily_appraisal_snack",
              strict: true,
              schema
            }
          },

          /*
           * 필요 이상으로 긴 출력이 나오지 않도록 제한한다.
           */
          max_output_tokens: 4000
        })
      }
    );

    if (response.ok) {
      return await response.json();
    }

    const errorText = await response.text();

    /*
     * 429는 일시적인 TPM 제한일 수 있으므로
     * 잠시 기다렸다가 다시 시도한다.
     */
    if (response.status === 429 && attempt < maxAttempts) {
      const waitSeconds = 3 * Math.pow(2, attempt - 1);

      console.log(
        `Rate limit 발생. ${waitSeconds}초 후 재시도합니다.`
      );

      await new Promise(resolve =>
        setTimeout(resolve, waitSeconds * 1000)
      );

      continue;
    }

    throw new Error(
      `OpenAI API 오류 ${response.status}: ${errorText}`
    );
  }

  throw new Error("OpenAI API 요청에 실패했습니다.");
}


const result = await requestOpenAI();


/*
 * Responses API 결과에서 텍스트 추출
 */
let outputText = result.output_text;

if (!outputText && Array.isArray(result.output)) {
  for (const item of result.output) {
    if (!Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (
        content.type === "output_text" &&
        content.text
      ) {
        outputText = content.text;
        break;
      }
    }

    if (outputText) break;
  }
}

if (!outputText) {
  console.error(
    "OpenAI 응답 전체:",
    JSON.stringify(result, null, 2)
  );

  throw new Error(
    "OpenAI 응답에서 JSON 텍스트를 찾지 못했습니다."
  );
}


/*
 * JSON 파싱
 */
let snack;

try {
  snack = JSON.parse(outputText);
} catch (error) {
  console.error(
    "OpenAI가 반환한 값:",
    outputText
  );

  throw new Error(
    `OpenAI 응답 JSON 파싱 실패: ${error.message}`
  );
}


/*
 * 필수값 검증
 */
if (
  !snack.date ||
  !snack.title ||
  !snack.body ||
  !snack.key ||
  !snack.source_url
) {
  throw new Error(
    "스낵에 필수 필드가 없습니다."
  );
}


/*
 * ─────────────────────────────
 * 중복 검증
 * ─────────────────────────────
 */

/*
 * 1. URL 완전 동일
 */
if (recentUrls.includes(snack.source_url)) {
  throw new Error(
    `중복 기사 감지: 이미 사용한 URL입니다.\n${snack.source_url}`
  );
}


/*
 * 2. 기사 식별정보 동일
 *
 * 도메인이 달라도 newsId 등이 같으면 차단한다.
 */
const newFingerprint = getUrlFingerprint(
  snack.source_url
);

if (
  newFingerprint &&
  recentFingerprints.includes(newFingerprint)
) {
  throw new Error(
    `중복 기사 감지: 동일 기사 식별정보입니다.\n` +
    `URL: ${snack.source_url}\n` +
    `식별정보: ${newFingerprint}`
  );
}


/*
 * 3. 제목 완전 동일
 */
if (
  recentSnacks.some(
    x =>
      x.title &&
      x.title.trim().toLowerCase() ===
        snack.title.trim().toLowerCase()
  )
) {
  throw new Error(
    `중복 제목 감지: ${snack.title}`
  );
}


/*
 * 저장할 데이터 정리
 */
const cleaned = {
  date: snack.date,
  tag: snack.tag || "오늘의 스낵",
  title: snack.title,
  body: snack.body,
  key: snack.key,
  source_url: snack.source_url
};


/*
 * 기존 데이터 앞에 새 스낵 추가
 */
const nextSnacks = [
  cleaned,
  ...previousSnacks
]
  .filter(
    (item, index, array) =>
      index ===
      array.findIndex(
        x => x.title === item.title
      )
  )
  .slice(0, 60);


const next = {
  generated_at: new Date().toISOString(),
  snacks: nextSnacks
};


/*
 * news.json 저장
 */
await fs.writeFile(
  DATA_PATH,
  JSON.stringify(next, null, 2) + "\n",
  "utf8"
);


console.log(
  `새 스낵 생성 완료: ${cleaned.title}`
);

console.log(
  `핵심 변수: ${cleaned.key}`
);

console.log(
  `출처: ${cleaned.source_url}`
);