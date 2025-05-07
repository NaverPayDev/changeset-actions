import {ExecOutput} from '@actions/exec'

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
