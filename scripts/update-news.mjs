
import fs from "node:fs/promises";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) throw new Error("OPENAI_API_KEY secret이 없습니다.");

const DATA_PATH = "data/news.json";

const existing = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
const previousSnacks = existing.snacks || [];

/*
 * 최근 스낵 정보
 */
const recentSnacks = previousSnacks.slice(0, 20);

const recentTitles = recentSnacks
  .map(x => x.title)
  .filter(Boolean);

const recentTopics = recentSnacks
  .map(x => `${x.tag || ""} | ${x.key || ""}`)
  .filter(Boolean);

const recentUrls = recentSnacks
  .map(x => x.source_url)
  .filter(Boolean);

/*
 * URL에서 기사 식별에 도움이 되는 정보 추출
 *
 * 같은 기사가
 * korea.kr
 * admin.korea.kr
 * 처럼 다른 도메인/주소로 저장되는 경우를 잡기 위한 보조장치다.
 */
function getUrlFingerprint(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    const params = [...parsed.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([key]) =>
        /id|news|article|articleid|newsid|no|idx|seq/i.test(key)
      );

    if (params.length > 0) {
      return params
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
 * 최근 사용된 기사와 관련된 정보를 모델에게 전달한다.
 */
const recentHistory = recentSnacks
  .map((snack, index) => {
    return `
${index + 1}.
제목: ${snack.title || ""}
태그: ${snack.tag || ""}
핵심 관계: ${snack.key || ""}
출처 URL: ${snack.source_url || ""}
기사 식별정보: ${getUrlFingerprint(snack.source_url)}
`;
  })
  .join("\n");


const prompt = `
오늘은 ${today}입니다.

너는 '감정평가 데일리 스낵'의 편집자이자,
감정평가를 공부한 지 약 6개월 된 수험생에게
최신 뉴스를 감정평가의 가격 결정 변수와 연결해서 설명하는 분석가다.


━━━━━━━━━━━━━━━━━━
[최우선 목표]
━━━━━━━━━━━━━━━━━━

단순히 '감정평가와 관련된 뉴스'를 찾는 것이 목표가 아니다.

뉴스 하나를 읽은 뒤 수험생이

"어? 이 뉴스가 감정평가랑 이렇게 연결되는구나."

라고 느끼게 만드는 것이 목표다.

특히 뉴스 속에서

'무엇이 변했는가'
→ '어떤 가격 결정 변수가 움직이는가'
→ '그 변수는 가치에 어떤 경로로 영향을 주는가'

를 찾아낸다.


━━━━━━━━━━━━━━━━━━
[1. 뉴스 선정]
━━━━━━━━━━━━━━━━━━

반드시 웹 검색으로 최근 실제 뉴스를 확인한다.

가능한 분야:

- 부동산
- 토지
- 주택
- 재개발·재건축
- 도시정비
- 토지보상
- 공시지가
- 감정평가
- 판례
- 세금
- 금리·금융
- 인프라
- 개발사업
- 국토·도시정책
- 부동산 규제
- 공공사업
- 교통망
- 산업시설
- 기업 이전
- 지역경제
- 상권

단순한

"서울 집값이 올랐다."

같은 뉴스보다,

왜 가치가 변하는지를 설명할 수 있는 뉴스를 우선한다.

특히 다음 변수의 변화가 드러나는 뉴스를 선호한다.

- 개발 가능성
- 최유효이용
- 용도지역
- 인허가 가능성
- 사업기간
- 개발비용
- 금융비용
- 금리
- 임대료
- 공실률
- 수익률
- 요구수익률
- 교통 접근성
- 수요
- 공급
- 위험
- 권리관계
- 토지 이용 제한
- 보상 기준
- 공공기여
- 개발이익
- 거래 가능성


━━━━━━━━━━━━━━━━━━
[2. 중복 기사 방지 — 매우 중요]
━━━━━━━━━━━━━━━━━━

최근 스낵과 동일한 기사를 절대로 다시 선택하지 않는다.

특히 다음을 모두 고려한다.

1. URL이 완전히 같은 기사
2. URL의 도메인만 다른 동일 기사
3. 같은 newsId/articleId/article 번호를 가진 기사
4. 같은 정부 발표나 정책자료를 다른 URL로 제공한 경우
5. 같은 사건을 다른 언론사가 거의 그대로 보도한 경우
6. 같은 정책·사업을 단순히 다른 제목으로 다시 설명하는 경우

예를 들어:

https://www.korea.kr/...newsId=12345

와

https://admin.korea.kr/...newsId=12345

는 서로 다른 기사로 취급하지 않는다.

또한 정부 보도자료를

- korea.kr
- 국토교통부
- 정부 정책브리핑
- 다른 정부 도메인

등에서 다른 URL로 제공하는 경우도 동일한 원문/발표라면 피한다.


━━━━━━━━━━━━━━━━━━
[3. 최근 사용된 스낵]
━━━━━━━━━━━━━━━━━━

아래는 최근 20개의 스낵이다.

${recentHistory}

위 목록과 동일한 기사, 동일한 사건, 동일한 정책, 동일한 발표를 다시 선택하지 않는다.

단순히 제목만 다르게 만들어서 재사용하면 안 된다.


━━━━━━━━━━━━━━━━━━
[4. 새로운 뉴스가 부족한 경우]
━━━━━━━━━━━━━━━━━━

최근 뉴스가 부족하더라도 이미 사용한 기사를 억지로 재사용하지 않는다.

대신 검색 범위를 넓힌다.

예:

- 다른 지역
- 다른 부동산 유형
- 다른 정책 분야
- 판례
- 세금
- 금융
- 인프라
- 산업시설
- 도시계획
- 보상
- 공공사업

그래도 최근 뉴스 중 적절한 것이 없다면
조금 더 오래된 뉴스 중 아직 사용하지 않은 사례를 선택한다.

'중복 회피'가 '최신성'보다 중요할 수 있다.


━━━━━━━━━━━━━━━━━━
[5. 감정평가적 분석]
━━━━━━━━━━━━━━━━━━

뉴스를 선택한 뒤 반드시 다음 질문을 생각한다.

"이 뉴스 때문에 부동산의 어떤 가격 결정 변수가 움직이는가?"

그리고 다음 구조로 분석한다.

뉴스의 사실
→ 변화한 조건
→ 변화한 가격 결정 변수
→ 가치에 미치는 영향
→ 반대 방향으로 작용할 수 있는 변수


예:

개발 가능성 ↑
→ 예상 사업수익 ↑
→ 토지에 귀속되는 잔여이익 ↑
→ 토지가치 상승 가능

하지만

개발기간 ↑
→ 금융비용 ↑
→ 위험 ↑
→ 현재가치 ↓

처럼 서로 다른 변수를 함께 본다.


━━━━━━━━━━━━━━━━━━
[6. 수험생 수준]
━━━━━━━━━━━━━━━━━━

독자는 감정평가를 공부한 지 약 6개월 된 수험생이다.

다음 개념은 이미 알고 있다고 가정한다.

- 최유효이용
- 거래사례비교법
- 원가법
- 수익환원법
- 개발법
- 시장가치
- 정상가격
- 지가
- 임대료
- 자본환원율
- 할인율
- 개발이익
- 권리관계
- 지역분석
- 개별분석
- 경제적 감가
- 용도지역
- 보상평가의 기본 구조

하지만 전문용어를 많이 사용하는 것을
'깊은 분석'이라고 생각하지 않는다.

이미 배운 개념이 실제 뉴스에서 어떻게 작동하는지를 보여준다.


━━━━━━━━━━━━━━━━━━
[7. 숨은 그림찾기 방식]
━━━━━━━━━━━━━━━━━━

처음부터 답을 알려주지 않는다.

뉴스의 사실을 먼저 보여주고
그 안에 숨어 있는 가격 결정 변수를 발견하게 만든다.

좋은 스낵은 다음과 같은 사고를 유도한다.

"정부가 땅을 산다."
→ "왜 이 땅을 사지?"
→ "왜 측량감평이 필요하지?"
→ "아, 개발 가능성과 가격을 확인하는 거구나."


━━━━━━━━━━━━━━━━━━
[8. 교과서적인 설명 금지]
━━━━━━━━━━━━━━━━━━

다음과 같은 설명은 피한다.

- 감정평가는 시장가치를 평가한다.
- 수요와 공급이 중요하다.
- 최유효이용은 중요하다.
- 이 뉴스는 감정평가와 관련 있다.

너무 당연한 설명이다.

대신

"왜 이 뉴스에서 이 변수가 중요해졌는가?"

를 설명한다.


━━━━━━━━━━━━━━━━━━
[9. 제목]
━━━━━━━━━━━━━━━━━━

제목은 기사 제목을 그대로 복사하지 않는다.

'왜?'라는 궁금증을 만들되 낚시성 표현은 금지한다.

예:

- 개발 가능해졌는데, 왜 땅값이 바로 오르지 않을까?
- 공공이 땅을 사는데, 왜 현재 이용보다 다른 걸 볼까?
- 교통망이 생기면 땅값은 정말 전부 같이 오를까?

단, 제목의 내용은 실제 기사로 뒷받침되어야 한다.


━━━━━━━━━━━━━━━━━━
[10. body]
━━━━━━━━━━━━━━━━━━

body는 4~6문장으로 작성한다.

권장 구조:

1문장:
뉴스의 핵심 사실.

2문장:
무엇이 변화했는지 설명.

3문장:
그 변화가 가치에 영향을 미치는 경로.

4문장:
반대 방향의 변수 또는 위험.

5문장:
감정평가적으로 흥미로운 이유.

필요하면 6문장까지 허용한다.

기사 내용을 장황하게 요약하지 않는다.

body에는 Markdown 링크를 넣지 않는다.


━━━━━━━━━━━━━━━━━━
[11. key]
━━━━━━━━━━━━━━━━━━

key는 핵심적인 가격 결정 변수의 관계를 한 문장으로 쓴다.

좋은 예:

"개발 가능성의 증가는 예상 잔여이익을 높이지만, 개발기간·비용·위험이 커지면 그 상승분은 현재가치에서 다시 할인된다."

나쁜 예:

"개발 가능성이 중요하다."


━━━━━━━━━━━━━━━━━━
[12. 출처]
━━━━━━━━━━━━━━━━━━

반드시 실제 검색으로 확인한 기사 또는 공식 발표의 URL 하나를 넣는다.

URL을 추측하지 않는다.

확인하지 않은 URL을 만들어내지 않는다.

가능하면 다음 출처를 우선한다.

- 정부 부처
- 공공기관
- 법원
- 한국은행
- 국토교통부
- 기획재정부
- 국세청
- 지자체
- 공공 연구기관
- 주요 언론사


━━━━━━━━━━━━━━━━━━
[13. 최종 선택 기준]
━━━━━━━━━━━━━━━━━━

후보 뉴스가 여러 개라면 다음 순서로 평가한다.

1. 가격 결정 변수가 명확한가?
2. 감정평가 개념과 연결되는가?
3. 실제 사례인가?
4. 의외의 관계가 있는가?
5. '왜?'라는 질문을 만들 수 있는가?
6. 서로 충돌하는 변수가 있는가?
7. 최근 스낵과 겹치지 않는가?


최종적으로 가장 흥미로운 뉴스 하나만 선택한다.


━━━━━━━━━━━━━━━━━━
[최종 출력]
━━━━━━━━━━━━━━━━━━

반드시 아래 JSON 구조만 반환한다.

{
  "date": "YYYY-MM-DD",
  "tag": "짧은 분야명",
  "title": "호기심을 만드는 제목",
  "body": "4~6문장의 한국어 설명",
  "key": "핵심 가격 결정 변수의 관계를 보여주는 한 문장",
  "source_url": "실제로 확인한 기사 또는 공식 발표 URL"
}
`;


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
 * OpenAI Responses API 호출
 */
const response = await fetch("https://api.openai.com/v1/responses", {
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
    }
  })
});


if (!response.ok) {
  const errorText = await response.text();

  throw new Error(
    `OpenAI API 오류 ${response.status}: ${errorText}`
  );
}


const result = await response.json();


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
 * 기본적인 필드 검증
 */
if (
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
 * 출처 URL 중복 검증
 *
 * 1차: 완전히 동일한 URL
 */
if (recentUrls.includes(snack.source_url)) {
  throw new Error(
    `중복 기사 감지: 이미 사용한 source_url입니다.\n${snack.source_url}`
  );
}


/*
 * 출처 식별정보 중복 검증
 *
 * 예:
 * korea.kr/...newsId=123
 * admin.korea.kr/...newsId=123
 *
 * 처럼 URL 도메인이 달라도 동일 기사라면 차단한다.
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
    `새 URL: ${snack.source_url}\n` +
    `식별정보: ${newFingerprint}`
  );
}


/*
 * 제목 중복도 한 번 더 방어한다.
 */
if (
  recentTitles.some(
    title =>
      title.trim().toLowerCase() ===
      snack.title.trim().toLowerCase()
  )
) {
  throw new Error(
    `중복 제목 감지: ${snack.title}`
  );
}


const cleaned = {
  date: snack.date,
  tag: snack.tag || "오늘의 스낵",
  title: snack.title,
  body: snack.body,
  key: snack.key,
  source_url: snack.source_url
};


/*
 * 기존 데이터에 추가
 *
 * 같은 제목이 이미 존재하는 경우에도
 * 중복 저장되지 않도록 한 번 더 방어한다.
 */
const nextSnacks = [
  cleaned,
  ...previousSnacks
].filter(
  (item, index, array) =>
    index ===
    array.findIndex(
      x => x.title === item.title
    )
).slice(0, 60);


const next = {
  generated_at: new Date().toISOString(),
  snacks: nextSnacks
};


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