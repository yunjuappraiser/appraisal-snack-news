import fs from "node:fs/promises";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) throw new Error("OPENAI_API_KEY secret이 없습니다.");

const DATA_PATH = "data/news.json";
const existing = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
const recentTitles = (existing.snacks || [])
  .slice(0, 14)
  .map(x => x.title);

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

너는 '감정평가 데일리 스낵'의 편집자다.

한국의 최신 부동산·토지·주택·재개발·재건축·도시정비·세금·금리·금융·인프라·공시지가·감정평가·보상·판례·부동산 정책 관련 뉴스 중,
감정평가를 공부하는 사람이 읽으면 "이게 감정평가와 이렇게 연결되는구나"라고 느낄 만한 이슈 1개를 골라라.

중요:
- 반드시 웹 검색을 사용해 오늘 또는 최근 며칠 이내의 실제 뉴스를 확인한다.
- 단순한 부동산 가격 뉴스보다 '왜 가치가 달라지는가', '어떤 가격·수익·위험·권리 변수가 움직이는가'가 드러나는 뉴스를 우선한다.
- 감정평가 공부 반년 정도 한 수험생이 흥미를 느낄 정도로 한 단계 깊게 쓴다.
- 너무 교과서적인 설명은 피한다.
- 기사 내용을 길게 요약하지 말고, 뉴스의 핵심 사실 → 감정평가에서 중요한 연결고리 순서로 쓴다.
- 과장하거나 사실을 만들어내지 않는다.
- 확인 가능한 기사 1개를 source_url로 넣는다.
- 제목은 호기심을 만들되 낚시성 표현은 쓰지 않는다.
- body는 3~5문장 정도의 한국어로 쓴다.
- key는 감정평가 관점의 핵심 변수 또는 관계를 한 문장으로 쓴다.
- 이전 스낵과 같은 주제·제목을 반복하지 않는다.

최근 사용한 제목:
${recentTitles.map(t => `- ${t}`).join("\n")}
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
  snacks: [cleaned, ...(existing.snacks || [])].slice(0, 60)
};

await fs.writeFile(
  DATA_PATH,
  JSON.stringify(next, null, 2) + "\n",
  "utf8"
);

console.log(`새 스낵 생성 완료: ${cleaned.title}`);
