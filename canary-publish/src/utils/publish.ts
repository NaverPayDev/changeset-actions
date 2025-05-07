import {execSync} from 'node:child_process'

import * as core from '@actions/core'
import {ExecOutput, exec} from '@actions/exec'

import {uniqBy} from '$actions/utils'

export function getPublishedPackageInfos({packagesDir, execOutput}: {execOutput: ExecOutput; packagesDir: string}) {
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
            : `${packagesDir} 하위 변경된 파일이 없어, 배포된 패키지가 없습니다.`

    return {
        message,
        publishedPackages: uniqPackages,
    }
}

export async function createReleaseForTags(tags: string[]) {
    for (const tag of tags) {
        // 이미 Release가 생성된 태그는 건너뜀
        try {
            await exec('gh', ['release', 'view', tag])
            core.info(`Release already exists for tag: ${tag}`)
            continue
        } catch {
            // IGNORE: release가 없으면 진행
        }

        // 커밋 로그 추출하여 릴리즈 노트 생성
        const notes = execSync(`git log ${tag}^..${tag} --pretty=format:"- %s"`, {encoding: 'utf8'})

        /**
         * GitHub Release 생성
         * @see https://cli.github.com/manual/gh_release_create
         */
        await exec('gh', ['release', 'create', tag, '--title', tag, '--notes', notes || 'No changes', '--prerelease'])
        core.info(`Created Release for tag: ${tag}`)
    }
}
