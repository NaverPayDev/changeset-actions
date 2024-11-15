import {humanId} from 'human-id'

import {CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM} from '../constants'

type VERSION = 'major' | 'minor' | 'patch'

export function getNewChangesetTemplate(
    changedPackageNames: string[],
    title: string,
    prUrl: string,
    versionType: VERSION,
) {
    const contents = [
        '---',
        ...changedPackageNames.map((x) => `"${x}": ${versionType}`),
        '---',
        '',
        '',
        '<!-- 변경된 사항을 입력해주세요. (이 줄을 지우고 하단에 명확하게 작성해주세요.) -->',
        '',
        `[${title}](${prUrl})`,
    ].join('\n')

    return encodeURIComponent(contents)
}

export function getAddChangesetUrl(
    changedPackageNames: string[],
    pull_request: {
        [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
        number: number
        html_url?: string
        body?: string
    },
    versionType: VERSION,
) {
    const fileName = humanId({
        separator: '-',
        capitalize: false,
    })

    const commitMessage = `[${versionType}] ${fileName}`

    return `${pull_request.head.repo.html_url}/new/${
        pull_request.head.ref
    }?filename=.changeset/${fileName}.md&value=${getNewChangesetTemplate(
        changedPackageNames,
        pull_request.title,
        pull_request.html_url || '',
        versionType,
    )}&message=${encodeURIComponent(commitMessage)}`
}

export function getChangedPackagesGithubComment({
    changedPackages,
    pullRequest,
    skipLabel,
}: {
    changedPackages: string[]
    pullRequest: {
        [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
        number: number
        html_url?: string
        body?: string
    }
    skipLabel?: string
}) {
    return [
        `> ${CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM}`,
        '',
        `\`${changedPackages.join('`, `')}\` 패키지${
            changedPackages.length > 1 ? '들' : ''
        }에 변경사항이 감지되었습니다.`,
        '',
        `${skipLabel != null ? `만약, 버전 변경이 필요 없다면 ${skipLabel}을 label에 추가해주세요.` : ''}`,
        '',
        '.changeset에 변경사항을 추가하고싶다면 아래에서 하나를 선택해주세요',
        '',
        `X.0.0 [major bump](${getAddChangesetUrl(changedPackages, pullRequest, 'major')})`,
        `0.X.0 [minor bump](${getAddChangesetUrl(changedPackages, pullRequest, 'minor')})`,
        `0.0.X [patch bump](${getAddChangesetUrl(changedPackages, pullRequest, 'patch')})`,
    ].join('\n')
}

export function getChangesetEmptyGithubComment() {
    return [
        `> ${CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM}`,
        '',
        '변경된 파일이 없습니다. commit을 확인해주세요.',
        'packages_dir 지정이 안되어 있거나, markdown 파일만 변경점에 있다면, 탐지되지 않을 수 있습니다.',
    ].join('\n')
}
