
import fs from "node:fs/promises";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) throw new Error("OPENAI_API_KEY secret이 없습니다.");

const DATA_PATH = "data/news.json";

const existing = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
const previousSnacks = existing.snacks || [];

const recentTitles = previousSnacks
  .slice(0, 20)
  .map(x => x.title)
  .filter(Boolean);

const recentTopics = previousSnacks
  .slice(0, 12)
  .map(x => `${x.tag || ""} | ${x.key || ""}`)
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

const prompt = `
오늘은 ${today}입니다.

너는 '감정평가 데일리 스낵'의 편집자이자,
감정평가를 공부한 지 약 6개월 된 수험생에게 뉴스를 설명하는 경제·부동산 분석가다.

오늘의 목표는 단순히 "감정평가와 관련된 뉴스"를 하나 소개하는 것이 아니다.

뉴스 하나를 읽고 수험생이

"어? 이 뉴스가 감정평가랑 이렇게 연결되는구나."
"그러면 결국 가격을 움직이는 변수는 이거네."
"내가 배운 개념이 실제 세상에서는 이렇게 나타나는구나."

라고 느끼게 만드는 것이 목표다.


[1. 뉴스 선정]

한국의 최근 실제 뉴스 중 하나를 선택한다.

우선순위가 높은 분야:
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
- 산업시설 및 기업 이전
- 상권 및 지역경제

단순한 "집값이 올랐다/내렸다" 뉴스는 가급적 피한다.

대신 다음과 같이 '가격을 움직이는 원인'이 드러나는 뉴스를 선호한다.

예:
- 용도지역 변화
- 개발 가능성 변화
- 인허가 가능성
- 교통망 변화
- 사업기간 변화
- 개발비용 변화
- 금리 변화
- 임대료 변화
- 공실률 변화
- 수익률 변화
- 위험 변화
- 권리관계 변화
- 토지 이용 제한
- 보상 기준 변화
- 정책으로 인한 공급·수요 변화
- 개발이익의 귀속 변화
- 거래 가능성 변화
- 최유효이용 변화


[2. 감정평가적 연결]

뉴스를 선택한 뒤 반드시 다음 질문을 스스로 생각한다.

"이 뉴스 때문에 부동산의 어떤 '가격 결정 변수'가 움직이는가?"

그리고 그 변수를 중심으로 설명한다.

단순히

"이것은 감정평가에서 중요합니다."

라고 끝내지 않는다.

반드시 다음 구조를 만든다.

뉴스의 사실
→ 무엇이 바뀌었는가
→ 그 변화가 토지·건물의 가치에 어떤 변수를 통해 영향을 주는가
→ 감정평가에서는 그 변화를 어떻게 바라볼 수 있는가


[3. 수험생 수준]

독자는 감정평가를 공부한 지 약 6개월 된 수험생이다.

따라서 완전 초보에게 설명하듯 너무 쉽게 만들지 않는다.

이미 다음 정도의 개념은 알고 있다고 가정한다.

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
- 지역분석·개별분석
- 경제적 감가
- 용도지역
- 보상평가의 기본 구조

다만 전문용어를 많이 사용하는 것이 "깊은 설명"은 아니다.

이미 배운 개념을 실제 뉴스의 변수와 연결해서
한 단계 더 생각하게 만드는 것이 중요하다.


[4. 가장 중요한 기준 — 변수]

감정평가는 결국 여러 변수 사이의 관계를 통해 가격을 설명하는 학문이라는 관점에서 작성한다.

따라서 가능하면 다음과 같은 관계를 보여준다.

예:

개발 가능성 ↑
→ 예상 사업수익 ↑
→ 토지에 귀속될 잔여이익 ↑
→ 토지가치 ↑

또는

금리 ↑
→ 요구수익률 ↑
→ 현재가치 ↓
→ 수익형 부동산 가치 ↓

또는

교통 접근성 ↑
→ 이용 가능 수요 ↑
→ 예상 임대료·매출 ↑
→ 최유효이용 변화 가능
→ 토지가치 ↑

단, 실제 뉴스에서 이러한 관계가 성립한다고 단정할 수 없는 경우에는
반드시 위험·비용·기간 등의 반대 요인도 고려한다.

특히 개발 관련 뉴스에서는

"개발 가능 = 무조건 가격 상승"

이라고 단순화하지 않는다.

개발 가능성뿐 아니라

- 개발비용
- 개발기간
- 금융비용
- 인허가 위험
- 시장 위험
- 사업성
- 공공기여
- 세금
- 토지 확보 비용

등을 함께 고려한다.


[5. '숨은 그림찾기' 방식]

이 스낵을 읽는 사람이 처음부터 답을 알 수 있게 만들지 않는다.

뉴스의 사실을 먼저 보여주고,
그 안에 숨어 있는 감정평가적 포인트를 발견하게 만든다.

좋은 스낵은 다음과 같은 느낌이어야 한다.

"정부가 땅을 산다는 뉴스네."
→ "그런데 왜 측량감평을 하지?"
→ "아, 단순히 면적만 확인하는 게 아니구나."
→ "결국 개발 가능성과 가격의 관계를 보는 거구나."

즉, 뉴스 자체보다
뉴스 속에 숨어 있는 '가격 결정 메커니즘'을 발견하게 한다.


[6. 너무 교과서적인 설명 금지]

다음과 같은 문장은 피한다.

- "이 뉴스는 감정평가와 관련이 있습니다."
- "감정평가사는 시장가치를 평가합니다."
- "부동산 가격은 수요와 공급에 의해 결정됩니다."
- "최유효이용은 감정평가에서 중요합니다."

이런 내용은 너무 당연하다.

대신

"왜 이 뉴스에서 그 변수가 중요해졌는가?"

를 설명한다.


[7. 깊이 있는 분석]

가능하다면 뉴스 하나에서 서로 충돌하는 두 변수를 보여준다.

예:

개발 가능성 ↑
→ 가치 상승 요인

하지만

개발기간 ↑
→ 할인율 적용기간 ↑
→ 현재가치 하락 요인

따라서

"개발 호재 = 토지가격 상승"

으로 끝나는 것이 아니라

"개발 가능성의 증가가 사업기간·비용·위험의 증가를 얼마나 상쇄하느냐"

가 실제 가격의 핵심이라는 식으로 생각하게 한다.

이런 구조를 특히 선호한다.


[8. 제목]

제목은 뉴스 제목을 그대로 복사하지 않는다.

수험생이 읽다가

"왜?"

라는 생각이 들게 만든다.

좋은 제목의 방향:

- "개발 가능해졌는데, 왜 땅값이 바로 오르지 않을까?"
- "공공이 땅을 사는데, 왜 '현재 이용'보다 다른 걸 볼까?"
- "교통망이 생기면 땅값은 정말 전부 같이 오를까?"

단, 실제 뉴스 내용으로 뒷받침할 수 없는 낚시성 제목은 금지한다.


[9. body 작성 규칙]

body는 4~6문장의 한국어로 작성한다.

권장 구조:

1문장:
뉴스의 핵심 사실.

2문장:
그 뉴스에서 실제로 변화한 조건이나 변수를 제시.

3문장:
그 변수가 감정평가상 가격에 어떤 경로로 영향을 주는지 설명.

4문장:
단순한 상승·하락이 아닌 반대 요인이나 추가적인 변수 하나를 보여준다.

5문장:
"그래서 이 뉴스가 감정평가적으로 흥미로운 이유"를 정리한다.

필요하면 6문장까지 허용한다.

기사 내용을 길게 요약하지 않는다.

body 안에는 Markdown 링크를 넣지 않는다.
source_url에만 출처를 넣는다.


[10. key 작성 규칙]

key는 이 스낵의 핵심적인 '가격 결정 관계'를 한 문장으로 쓴다.

단순한 주제가 아니라 변수 간 관계를 적는다.

좋은 예:

"개발 가능성의 증가는 토지가치를 높이지만, 개발기간·비용·위험이 커지면 그 상승분은 현재가치에서 다시 할인된다."

나쁜 예:

"개발 가능성이 중요하다."

가능하면

A ↑ → B ↑ → C ↑

또는

A ↑ → B ↑ → C ↓

처럼 변수의 관계가 드러나도록 한다.


[11. 중복 방지]

최근 스낵과 같은 뉴스나 같은 관점을 반복하지 않는다.

특히 최근 스낵과 동일한 정책·사업을 단순히 다른 제목으로 다시 다루지 않는다.

다만 같은 분야라도 완전히 다른 가격 결정 변수나 새로운 사건이 발생했다면 선택할 수 있다.

최근 사용한 제목:
${recentTitles.map(t => `- ${t}`).join("\n")}

최근 스낵의 주제와 핵심 관계:
${recentTopics.map(t => `- ${t}`).join("\n")}


[12. 출처]

반드시 실제 존재하는 최신 기사 또는 공식 발표를 확인한다.

가능하면 다음과 같은 신뢰도 높은 출처를 우선한다.

- 정부 부처
- 법원
- 공공기관
- 한국은행
- 국토교통부
- 기획재정부
- 국세청
- 지자체
- 공공 연구기관
- 주요 언론사

반드시 웹 검색을 통해 실제 내용을 확인한다.

source_url에는 실제 확인한 기사 또는 공식 발표의 URL을 하나만 넣는다.

URL을 추측해서 만들지 않는다.

확인하지 못한 URL을 만들어내지 않는다.


[13. 최종 선택 기준]

후보 뉴스가 여러 개라면 다음 순서로 평가한다.

1. 감정평가와 연결되는 가격 결정 변수가 명확한가?
2. 수험생이 이미 배운 개념과 연결할 수 있는가?
3. 단순한 교과서 설명이 아닌 실제 사례인가?
4. 서로 충돌하는 변수나 의외의 관계가 있는가?
5. "왜?"라는 질문을 만들어낼 수 있는가?
6. 앞으로 공부할 감정평가 개념을 자연스럽게 떠올리게 하는가?
7. 최근 스낵과 중복되지 않는가?

위 기준에서 가장 흥미로운 뉴스 하나만 선택한다.


최종적으로 반드시 아래 JSON 구조만 반환한다.

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
 * Responses API 결과를 안전하게 추출한다.
 * output_text가 없는 경우 실제 output 배열을 확인한다.
 */
let outputText = result.output_text;

if (!outputText && Array.isArray(result.output)) {
  for (const item of result.output) {
    if (!Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content.type === "output_text" && content.text) {
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
  console.error("OpenAI가 반환한 값:", outputText);
  throw new Error(
    `OpenAI 응답 JSON 파싱 실패: ${error.message}`
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

const next = {
  generated_at: new Date().toISOString(),
  snacks: [cleaned, ...previousSnacks]
    .filter(
      (item, index, array) =>
        index === array.findIndex(x => x.title === item.title)
    )
    .slice(0, 60)
};

await fs.writeFile(
  DATA_PATH,
  JSON.stringify(next, null, 2) + "\n",
  "utf8"
);

console.log(`새 스낵 생성 완료: ${cleaned.title}`);
console.log(`핵심 변수: ${cleaned.key}`);
console.log(`출처: ${cleaned.source_url}`);
