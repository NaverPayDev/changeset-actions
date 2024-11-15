import * as core from '@actions/core'
import {exec, getExecOutput} from '@actions/exec'
import readChangesets from '@changesets/read'
import fs from 'fs-extra'
import resolveFrom from 'resolve-from'

import createFetchers from '$actions/apis'
import {getChangedAllFiles} from '$actions/utils'

import {getChangedPackages, protectUnchangedPackages, removeChangesetMdFiles} from './utils/file'
import {setNpmRc} from './utils/npm'
import {getPublishedPackageInfos} from './utils/publish'

const cwd = process.cwd()

async function main() {
    // npmrc 설정
    await setNpmRc()

    const {pullFetchers, issueFetchers} = createFetchers()
    const pullRequestInfo = await pullFetchers.getPullRequestInfo()

    try {
        // 변경된 사항이 있는지 체크.
        // 변경사항이 있을때만 카나리를 배포 할 수 있다.
        const changesets = await readChangesets(cwd)

        if (changesets.length === 0) {
            await issueFetchers.addComment('올바른 카나리 버전 배포를 위해 detect version을 명시해주세요')

            return
        }

        const changedFiles = await getChangedAllFiles({
            pullNumber: pullRequestInfo.number,
        })

        // 변경된 패키지 파일을 가져온다
        const packagesDir = core.getInput('packages_dir')
        const changedPackageInfos = await getChangedPackages({
            packagesDir: packagesDir.split(',') as string[],
            changedFiles,
        })

        if (changedPackageInfos.length === 0) {
            core.info('변경된 패키지가 없습니다.')
            return
        }

        await Promise.all([
            // 이번 변경건과 관련없는 모든 .changeset/*.md 파일을 제거한다.
            removeChangesetMdFiles({changedFiles}),
            // 변경사항외 다른 패키지들의 배포를 막습니다.
            protectUnchangedPackages(changedPackageInfos),
        ])

        // 패키지 변경 버전 반영
        await exec('node', [resolveFrom(cwd, '@changesets/cli/bin.js'), 'version'], {
            cwd,
        })

        // publish 스크립트에 태그를 붙여줍니다.
        const npmTag = core.getInput('npm_tag')
        const rootPackageJsonPath = `package.json`
        const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'))

        for (const [key, script] of Object.entries(rootPackageJson.scripts as Record<string, string>)) {
            if (script.includes('changeset publish')) {
                // 카나리배포는 태그를 남기지 않습니다
                if (!script.includes('--no-git-tag')) {
                    rootPackageJson.scripts[key] = script.replace('changeset publish', 'changeset publish --no-git-tag')
                }
                // 카나리배포는 npmTag 태그를 추가합니다
                if (!script.includes('--tag')) {
                    rootPackageJson.scripts[key] = script.replace('--no-git-tag', `--no-git-tag --tag=${npmTag}`)
                }
            }
        }
        fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2), 'utf8')

        // 변경된 패키지들의 버전을 강제로 치환합니다
        changedPackageInfos.forEach((packageJsonPath) => {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

            const newVersion = `${packageJson.version}-${npmTag}-${(pullRequestInfo.head.sha as string).slice(0, 7)}`

            core.info(`✅ [${packageJson.name}] 이전 버전: ${packageJson.version} / 😘 새로운 버전: ${newVersion}`)

            packageJson.version = newVersion

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
        })

        // 변경된 버전으로 카나리 배포
        const publishScript = core.getInput('publish_script')
        const [publishCommand, ...publishArgs] = publishScript.split(/\s+/)

        // 배포 스크립트 실행
        const changesetPublishOutput = await getExecOutput(publishCommand, [...publishArgs], {cwd})

        // 배포된 패키지들의 정보와 배포 메세지를 가져옵니다
        const {message, publishedPackages} = getPublishedPackageInfos({
            execOutput: changesetPublishOutput,
            packagesDir,
        })

        // 배포 완료 코멘트
        await issueFetchers.addComment(message)

        // output 설정
        core.setOutput('published', 'true')
        core.setOutput('publishedPackages', JSON.stringify(publishedPackages))
        core.setOutput('message', message)
    } catch (e) {
        issueFetchers.addComment('카나리 배포 도중 에러가 발생했습니다.')
    }
}

main()
