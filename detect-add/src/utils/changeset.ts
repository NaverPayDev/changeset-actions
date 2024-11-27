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
        `${title}`,
        '',
        `PR: [${title}](${prUrl})`,
    ].join('\n')

    return encodeURIComponent(contents)
}

interface PullRequest {
    [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
    number: number
    html_url?: string
    body?: string
}

export function getAddChangesetUrl(changedPackageNames: string[], pull_request: PullRequest, versionType: VERSION) {
    const fileName = humanId({separator: '-', capitalize: false})
    const commitMessage = `[${versionType}] ${fileName}`

    const template = getNewChangesetTemplate(
        changedPackageNames,
        pull_request.title,
        pull_request.html_url || '',
        versionType,
    )
    const origin = pull_request.head.repo.html_url
    const pathname = `/new/${pull_request.head.ref}`
    const query = {filename: `.changeset/${fileName}.md`, value: template, message: encodeURIComponent(commitMessage)}
    const encodedQuery = Object.entries(query)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')

    return `${origin}${pathname}?${encodedQuery}`
}

const checksum = `<a href="https://github.com/NaverPayDev/changeset-actions/tree/main/detect-add"><sub>powered by: ${CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM}</sub></a>`

export function getChangedPackagesGithubComment({
    changedPackages,
    pullRequest,
    isKoreanLanguage,
    hasChangesetMarkdownInPullRequest,
    skipLabel,
}: {
    changedPackages: string[]
    pullRequest: PullRequest
    isKoreanLanguage: boolean
    hasChangesetMarkdownInPullRequest: boolean
    skipLabel?: string
}) {
    const commitComment = pullRequest.head?.sha
        ? isKoreanLanguage
            ? [`마지막 commit: ${pullRequest.head.sha}`, '']
            : [`Latest commit: ${pullRequest.head.sha}`, '']
        : []
    const labelComment = skipLabel
        ? isKoreanLanguage
            ? [`만약, 버전 변경이 필요 없다면 ${skipLabel}을 label에 추가해주세요.`, '']
            : [`If no version change is needed, please add ${skipLabel} to the label.`, '']
        : []
    const bumpComment = hasChangesetMarkdownInPullRequest
        ? []
        : [
              `X.0.0 [major bump](${getAddChangesetUrl(changedPackages, pullRequest, 'major')})`,
              `0.X.0 [minor bump](${getAddChangesetUrl(changedPackages, pullRequest, 'minor')})`,
              `0.0.X [patch bump](${getAddChangesetUrl(changedPackages, pullRequest, 'patch')})`,
              '',
          ]

    const packageNames = changedPackages.join('`, `')

    if (isKoreanLanguage) {
        return [
            hasChangesetMarkdownInPullRequest
                ? '### 🦋 Changeset 파일이 탐지되었습니다.'
                : '### ⚠️ Changeset 파일을 찾을 수 없습니다',
            '',
            ...commitComment,
            `\`${packageNames}\` 패키지${changedPackages.length > 1 ? '들' : ''}에 변경사항이 감지되었습니다.`,
            '',
            ...labelComment,
            hasChangesetMarkdownInPullRequest
                ? '**이 PR의 변경 사항은 다음 버전 업데이트에 포함될 예정입니다.**'
                : '**.changeset에 변경사항을 추가하고싶다면 아래에서 하나를 선택해주세요.**',
            '',
            ...bumpComment,
            checksum,
        ].join('\n')
    }
    return [
        hasChangesetMarkdownInPullRequest ? '### 🦋 Changeset detected' : '### ⚠️ No Changeset found',
        '',
        ...commitComment,
        `\`${packageNames}\` package${changedPackages.length > 1 ? 's' : ''} have detected changes.`,
        '',
        ...labelComment,
        hasChangesetMarkdownInPullRequest
            ? '**The changes in this PR will be included in the next version bump. **'
            : '**If you want to add changes to .changeset, please select one of the following options.**',
        '',
        ...bumpComment,
        checksum,
    ].join('\n')
}

export function getChangesetEmptyGithubComment({
    isKoreanLanguage,
    pullRequest,
}: {
    isKoreanLanguage: boolean
    pullRequest: PullRequest
}) {
    const commitComment = pullRequest.head?.sha
        ? isKoreanLanguage
            ? [`마지막 commit: ${pullRequest.head.sha}`]
            : [`Latest commit: ${pullRequest.head.sha}`]
        : []
    if (isKoreanLanguage) {
        return [
            '### 🔍 변경된 파일이 없습니다.',
            '',
            ...commitComment,
            '',
            'commit을 확인해주세요.',
            '',
            'packages_dir 지정이 안되어 있거나, markdown 파일만 변경점에 있다면, 탐지되지 않을 수 있습니다.',
            '',
            checksum,
        ].join('\n')
    }
    return [
        '### 🔍 No files have been changed',
        '',
        ...commitComment,
        '',
        'Please check your commit.',
        '',
        'If packages_dir is not specified or only markdown files are in the changes, detection may fail.',
        '',
        checksum,
    ].join('\n')
}
