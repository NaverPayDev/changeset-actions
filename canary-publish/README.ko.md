# changesets-canary-publish

## 설명

- changeset을 이용한 패키지 배포 플로우를 사용할 때, 해당 PR의 변경점을 파악하여 `.changeset` 하위 변경된 패키지들을 Canary 배포할 수 action 입니다.

## 사용 방법

- 프로젝트 root의 `.github/workflows` 경로에 아래와 같이 `.yaml` 파일을 작성합니다.

```yaml
# 기호에 맞게 변경해주세요
name: changeset canary publish

on:
    issue_comment:
        types:
            - created

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
    canary:
        if: ${{ github.event.issue.pull_request && (github.event.comment.body == 'canary-publish' || github.event.comment.body == '/canary-publish')}}
        runs-on: ubuntu-latest
        steps:
            - name: Get PR branch name
              id: get_branch
              run: |
                PR=$(curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" ${{ github.event.issue.pull_request.url }})
                echo "::set-output name=branch::$(echo $PR | jq -r '.head.ref')"

            - name: Checkout Repo
              uses: actions/checkout@v3
              with:
                ref: ${{ steps.get_branch.outputs.branch }}

            - name: Install Dependencies
              run: pnpm install --frozen-lockfile

            - name: Canary Publish
              uses: NaverPayDev/changeset-actions/canary-publish@main
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }}           # (필수) GitHub API 인증 토큰. 필요시 사용자 PAT로 대체 가능
                  npm_tag: canary                                    # (선택) 배포에 사용할 npm 태그 (예: canary, beta 등)
                  npm_token: ${{ secrets.NPM_TOKEN }}                # (필수) npm publish를 위한 인증 토큰
                  publish_script: pnpm run deploy:canary             # (필수) Canary 배포를 실행할 스크립트 명령어
                  packages_dir: packages                             # (선택) 변경 감지에 사용할 패키지 디렉터리 (기본값: packages,share)
                  excludes: ".turbo,.github"                         # (선택) 변경 감지에서 제외할 파일/디렉터리 목록 (쉼표로 구분)
                  version_template: '{VERSION}-canary.{DATE}-{COMMITID7}' # (선택) Canary 버전명 템플릿
                  dry_run: false                                     # (선택) true면 실제 배포 없이 시뮬레이션만 수행
                  language: 'en'                                     # (선택) 메시지 언어 설정 (en, ko 등)
                  create_release: false                              # (선택) true면 Canary 배포 후 GitHub  Release 자동 생성
```

### ⚠️ `create_release: true` 사용 시 주의사항

이 액션을 `create_release: true` 옵션과 함께 사용할 때는 아래 사항을 반드시 지켜주세요.

1. `actions/checkout`의 `fetch-depth: 0` 설정

    전체 git 히스토리를 받아와야 릴리즈 노트가 정확하게 생성됩니다.

    ```yml
    - uses: actions/checkout@v4
      with:
          fetch-depth: 0
    ```

2. `GH_TOKEN` 환경 변수 설정

    gh CLI 사용을 위해 인증 토큰이 필요합니다. 아래와 같이 환경 변수로 지정해 주세요.

    ```yml
    env:
        GH_TOKEN: ${{ github.token }}
    ```

    (job 또는 workflow 전체에 지정해도 됩니다.)

3. `permissions: contents: write` 권한 추가

    릴리즈 생성을 위해 해당 권한이 필요합니다.

    ```yml
    permissions:
        contents: write
    ```

예시 워크플로우

```yml
permissions:
  contents: write

jobs:
  release:
    env:
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: NaverPayDev/changeset-actions/canary-publish@main
        with:
          create_release: true
```

**위 설정이 누락되면 릴리즈 생성이 실패할 수 있습니다. 반드시 확인해 주세요!**


## 실행 결과

![example](./src/assets/example.png)
![example2](./src/assets/example2.png)
![example3](./src/assets/example3.png)
