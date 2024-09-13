# @NaverPayDev/changeset-actions

- changeset 기반의 다양한 액션을 모아놓은 레포입니다.
- 해당 레포는 모노레포 구조로 여러 액션을 포함하며, 필요한 액션만 선택하여 사용하실 수 있습니다.
- 사용법은 하단 액션 목록의 각 액션별 리드미를 참고해주세요.

## 관리 중인 액션 목록

#### detect add
PR의 변경점을 파악하여 `.changeset` 하위에 변경된 파일에 대한 정보를 기재할 수 있도록 유도하는 action

#### canary 
`.changeset` 하위 변경된 패키지들의 안전성을 테스트하기 위해 canary 버전으로 배포를 도와주는 action

#### publish 
`.changeset` 하위에 변경된 패키지들을 배포하고 자동으로 CHANGELOG 를 작성해주는 action 
