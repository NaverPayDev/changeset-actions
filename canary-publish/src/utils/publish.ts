import {execSync} from 'node:child_process'

import * as core from '@actions/core'
import {ExecOutput, exec} from '@actions/exec'
import {LANGUAGES} from 'canary-publish/src/constants/lang'

import {uniqBy} from '$actions/utils'

export function getPublishedPackageInfos({
    packagesDir,
    execOutput,
    language,
}: {
    execOutput: ExecOutput
    packagesDir: string
    language: 'ko' | 'en'
}) {
    const publishedPackages = []

    for (const publishOutput of execOutput.stdout.split('\n')) {
        // eslint-disable-next-line no-useless-escape
        const regExp = /^(🦋 {2})([A-Za-z-\d\/\@]+@)(.+)$/
        const matchResult = publishOutput.trim().match(regExp)
        if (!matchResult) {
            continue
        }
        const [, , name, version] = matchResult
        publishedPackages.push({name: name.slice(0, -1), version})
    }

    const uniqPackages = uniqBy(publishedPackages, ({name}) => name)

    const copyCodeBlock = uniqPackages.map(({name, version}) => `${name}@${version}`).join('\n')

    const message =
        uniqPackages.length > 0
            ? ['## Published Canary Packages', '', '', '```', `${copyCodeBlock}`, '```'].join('\n')
            : LANGUAGES[language].empty.replace('{PATH}', packagesDir)

    return {
        message,
        publishedPackages: uniqPackages,
    }
}

/**
 * changeset 변경 파일 커밋만 제외하고 작업 커밋 로그만 추출
 */
function getFilteredCommitMessages({
    baseSha,
    headSha,
    packagePath,
}: {
    baseSha: string
    headSha: string
    packagePath: string
}) {
    // 커밋 해시 목록만 추출
    const shas = execSync(`git log --reverse --pretty=format:"%H" ${baseSha}..${headSha} -- ${packagePath}`, {
        encoding: 'utf8',
    })
        .split('\n')
        .filter(Boolean)

    const messages = [
        '## 🚧 Pre-release',
        '',
        `This release is a **pre-release** version.`,
        'Please make sure to thoroughly test it before deploying to production.',
        '',
        '### Changes',
        '',
    ]

    for (const sha of shas) {
        // 해당 커밋의 변경 파일 목록 조회
        const files = execSync(`git show --pretty="" --name-only ${sha}`, {encoding: 'utf8'})
            .split('\n')
            .filter(Boolean)

        // .changeset/*.md 외에 변경된 파일이 하나라도 있으면 커밋 메시지에 추가
        const hasNonChangesetFile = files.some((file) => !/\.changeset\/.*\.md$/.test(file))

        if (hasNonChangesetFile) {
            const msg = execSync(`git log -1 --pretty=format:"- %s" ${sha}`, {encoding: 'utf8'})
            messages.push(msg)
        }
    }

    return messages.join('\n')
}

export async function createReleaseForTags({
    packageData,
    baseSha,
    headSha,
}: {
    packageData: {
        tag: string
        packagePath: string
    }[]
    baseSha: string
    headSha: string
}) {
    for (const {tag, packagePath} of packageData) {
        // 이미 Release가 생성된 태그는 건너뜀
        try {
            await exec('gh', ['release', 'view', tag])
            core.info(`Release already exists for tag: ${tag}`)
            continue
        } catch {
            // IGNORE: release가 없으면 진행
        }

        // 커밋 로그 추출하여 릴리즈 노트 생성
        const notes = getFilteredCommitMessages({baseSha, headSha, packagePath})

        /**
         * GitHub Release 생성
         * @see https://cli.github.com/manual/gh_release_create
         */
        await exec('gh', ['release', 'create', tag, '--title', tag, '--notes', notes || 'No changes', '--prerelease'])
        core.info(`Created Release for tag: ${tag}`)
    }
}
