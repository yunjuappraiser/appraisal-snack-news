import fs from "node:fs/promises";

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  throw new Error("OPENAI_API_KEY secret이 없습니다.");
}

const DATA_PATH = "data/news.json";

/*
 * 기존 news.json 읽기
 */
const existing = JSON.parse(
  await fs.readFile(DATA_PATH, "utf8")
);

const previousSnacks = existing.snacks || [];


/*
 * 최근 8개만 모델에게 전달
 *
 * 너무 많은 과거 데이터를 보내지 않아
 * 토큰 사용량을 줄인다.
 */
const recentSnacks = previousSnacks.slice(0, 8);

const recentHistory = recentSnacks
  .map(
    (x, i) =>
      `${i + 1}. ${x.title || ""} | ${x.key || ""}`
  )
  .join("\n");


/*
 * 최근 사용된 원문 URL
 */
const recentUrls = recentSnacks
  .map(x => x.source_url)
  .filter(Boolean);


/*
 * URL에서 기사 식별용 fingerprint 추출
 *
 * 예:
 * newsId=123
 * articleId=123
 * idx=123
 *
 * 등을 추출해서
 * 도메인이 달라도 같은 기사를 중복으로 잡는다.
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
 * 한국 기준 오늘 날짜
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
 * ─────────────────────────────
 * 스낵 생성 프롬프트
 * ─────────────────────────────
 *
 * 기존 ChatGPT 스케줄러의 프롬프트를
 * 최대한 그대로 반영한다.
 */
const prompt = `
오늘은 ${today}입니다.

감정평가와 관련된 교양, 최신 트렌드, 시사,
도시·부동산 이슈, 경제·사회 현상,
또는 감정평가의 학문적 흐름 중 하나를 골라
매일 하나씩 재미있는 스낵 콘텐츠로 정리해줘.

감정평가 공부에 도움이 되면서도
휴식 시간에 가볍게 볼 수 있어야 한다.

한 문단 내외의 짧은 설명으로 작성하고,
가능하면
"어? 이게 감정평가랑 연결되네"
라는 느낌이 들도록 구체적인 사례나
의외의 연결고리를 넣어줘.

너무 교과서적이거나 시험문제처럼 쓰지 말고,
감정평가를 약 6개월 공부한 사람이 읽었을 때
흥미롭고 한 단계 깊다고 느낄 정도로 작성해줘.

단순한 뉴스 요약보다는
뉴스 속 현상과 감정평가 사이의 구체적인 연결점을 보여줘.

가능하다면 개발가능성, 최유효이용,
토지이용, 인허가, 사업기간, 개발비용,
금융비용, 금리, 임대료, 수익률, 위험,
권리관계, 교통, 공급·수요, 보상,
공시지가 등의 변수가 가치에 어떤 영향을 주는지
자연스럽게 설명해줘.

마지막에는 반드시
"오늘의 핵심"을 한 문장으로 붙여줘.

중요:
시간이 지나면 변할 수 있는 내용
(시사, 정책, 법·제도, 시장 상황, 통계,
최신 연구·학문 흐름, 트렌드, 사례 등)은
반드시 작성 시점의 최신 정보를 웹에서 확인해줘.

가능하면 정부·공공기관·학술기관·공식 발표 등
1차 자료나 신뢰도 높은 최신 자료를 우선해줘.

오래된 지식에 의존하지 말고
현재 시점에서 유효한지 확인해줘.

또한 매 스낵에는 반드시
실제로 읽을 수 있는 최신 원문 기사 또는
공식 발표 자료 1개를 선정해줘.

source_url에는 실제 확인한 원문 페이지의
직접 URL을 넣어줘.

URL을 추측하거나 만들어내지 마.
가능하면 해당 기사의 직접 링크를 사용하고,
뉴스 내용과 원문 링크가 정확히 일치해야 한다.

최근 스낵과 동일한 기사,
동일한 사건,
동일한 정책·발표를
제목만 바꿔 재사용하지 마.

최근 스낵:
${recentHistory}

JSON만 반환해줘.
`;


/*
 * JSON Schema
 */
const schema = {
  type: "object",
  properties: {
    date: {
      type: "string"
    },

    tag: {
      type: "string"
    },

    title: {
      type: "string"
    },

    body: {
      type: "string"
    },

    key: {
      type: "string"
    },

    source_url: {
      type: "string"
    }
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
 * ─────────────────────────────
 * OpenAI API 요청
 * ─────────────────────────────
 */
const response = await fetch(
  "https://api.openai.com/v1/responses",
  {
    method: "POST",

    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      model: "gpt-5.4-mini",

      store: false,

      /*
       * 최신 뉴스 확인
       */
      tools: [
        {
          type: "web_search"
        }
      ],

      input: prompt,

      /*
       * JSON 형식 강제
       */
      text: {
        format: {
          type: "json_schema",
          name: "daily_appraisal_snack",
          strict: true,
          schema
        }
      },

      /*
       * 스낵 하나이므로
       * 필요 이상으로 긴 출력을 방지한다.
       */
      max_output_tokens: 2500
    })
  }
);


/*
 * API 오류 처리
 */
if (!response.ok) {
  const errorText = await response.text();

  throw new Error(
    `OpenAI API 오류 ${response.status}: ${errorText}`
  );
}


/*
 * API 결과
 */
const result = await response.json();


/*
 * Responses API에서 텍스트 추출
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
 * 필수 필드 검사
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
 * 중복 검사
 * ─────────────────────────────
 */

/*
 * 1. 완전히 같은 URL
 */
if (recentUrls.includes(snack.source_url)) {
  throw new Error(
    `중복 기사 감지: 이미 사용한 URL입니다.\n${snack.source_url}`
  );
}


/*
 * 2. 같은 기사 식별정보
 *
 * 다른 도메인의 동일 기사도 차단
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
    `${newFingerprint}`
  );
}


/*
 * 3. 동일 제목
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
 * ─────────────────────────────
 * 최종 데이터 정리
 * ─────────────────────────────
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
 * 새 스낵을 맨 앞에 추가
 *
 * 전체 보관 개수는 최대 60개
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


/*
 * 최종 JSON
 */
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


/*
 * 로그
 */
console.log(
  `새 스낵 생성 완료: ${cleaned.title}`
);

console.log(
  `태그: ${cleaned.tag}`
);

console.log(
  `핵심: ${cleaned.key}`
);

console.log(
  `출처: ${cleaned.source_url}`
);