# 감정평가 데일리 스낵 — 자동 업데이트 버전

## 구조

- `index.html` : 화면
- `data/news.json` : 스낵 데이터
- `scripts/update-news.mjs` : 최신 뉴스 검색 + 스낵 생성
- `.github/workflows/update-news.yml` : 매일 자동 실행

## GitHub에 올리는 방법

기존 저장소에 아래 파일/폴더를 그대로 넣습니다.

```text
index.html
data/news.json
scripts/update-news.mjs
.github/
  workflows/
    update-news.yml
```

## OpenAI API 키 등록

1. GitHub 저장소의 `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`
5. 이름을 정확히 `OPENAI_API_KEY`로 입력
6. OpenAI API 키를 Secret 값에 입력

API 키는 HTML에 넣으면 안 됩니다. 반드시 GitHub Actions Secret으로만 넣습니다.

## 자동 실행

매일 한국시간 오전 8:07에 실행되도록 설정되어 있습니다.
GitHub Actions의 `workflow_dispatch`도 함께 넣었기 때문에 처음에는
Actions 화면에서 수동으로 실행해서 정상 작동하는지 확인할 수 있습니다.

GitHub Pages가 저장소의 해당 브랜치를 보여주고 있다면,
`data/news.json`이 업데이트될 때 페이지에서 새 스낵이 자동으로 표시됩니다.

## 주의

OpenAI API 사용량에 따라 소액의 API 비용이 발생할 수 있습니다.
