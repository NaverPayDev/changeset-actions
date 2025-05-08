import * as core from '@actions/core'
import {exec, getExecOutput} from '@actions/exec'
import readChangesets from '@changesets/read'
import {LANGUAGES} from 'canary-publish/src/constants/lang'
import * as fs from 'fs-extra'
import resolveFrom from 'resolve-from'

import createFetchers from '$actions/apis'
import {getChangedAllFiles} from '$actions/utils'

import {getChangedPackages, protectUnchangedPackages, removeChangesetMdFiles} from './utils/file'
import {setNpmRc} from './utils/npm'
import {createReleaseForTags, getPublishedPackageInfos} from './utils/publish'

const cwd = process.cwd()

const VERSION_TEMPLATE_CONSTANTS = {
    version: 'VERSION',
    date: 'DATE',
    commitId7: 'COMMITID7',
}

async function main() {
    // npmrc 설정
    await setNpmRc()

    const {pullFetchers, issueFetchers} = createFetchers()
    const pullRequestInfo = await pullFetchers.getPullRequestInfo()
    const language = core.getInput('language') as 'ko' | 'en'

    try {
        // 변경된 사항이 있는지 체크.
        // 변경사항이 있을때만 카나리를 배포 할 수 있다.
        const changesets = await readChangesets(cwd)

        if (changesets.length === 0) {
            await issueFetchers.addComment(LANGUAGES[language].failure)

            return
        }

        const changedFiles = await getChangedAllFiles({
            pullNumber: pullRequestInfo.number,
        })

        // 변경된 패키지 파일을 가져온다
        const packagesDir = core.getInput('packages_dir')
        const excludes = core.getInput('excludes') ?? ''

        const changedPackageInfos = await getChangedPackages({
            packagesDir: packagesDir.split(',') as string[],
            excludes: excludes.split(',') as string[],
            changedFiles,
        })

        if (changedPackageInfos.length === 0) {
            core.info('No changed packages found.')
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

        const versionTemplate = core.getInput('version_template')

        // 변경된 패키지들의 버전을 강제로 치환합니다
        changedPackageInfos.forEach((packageJsonPath) => {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

            const today = new Date()
            const pad = (n: number) => n.toString().padStart(2, '0')
            const year2 = today.getFullYear().toString().slice(2)
            const dateStr = `${year2}${pad(today.getMonth() + 1)}${pad(today.getDate())}` // YYYYMMDD
            const commitId7 = (pullRequestInfo.head.sha as string).slice(0, 7)
            const version = packageJson.version

            const replacements = {
                [VERSION_TEMPLATE_CONSTANTS.version]: version,
                [VERSION_TEMPLATE_CONSTANTS.date]: dateStr,
                [VERSION_TEMPLATE_CONSTANTS.commitId7]: commitId7,
            }

            const templateConstantsString = Object.values(VERSION_TEMPLATE_CONSTANTS).join('|')
            const newVersion = versionTemplate.replace(
                new RegExp(`\\{(${templateConstantsString})\\}`, 'g'),
                (_, key) => {
                    return replacements[key] ?? ''
                },
            )

            core.info(
                `✅ [${packageJson.name}] Previous version: ${packageJson.version} / 😘 Next version: ${newVersion}`,
            )

            packageJson.version = newVersion

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
        })

        const dryRun = core.getBooleanInput('dry_run')

        if (dryRun) {
            core.info('This is dry run for Canary distribution.')
            return
        }

        // 변경된 버전으로 카나리 배포
        const publishScript = core.getInput('publish_script')
        const [publishCommand, ...publishArgs] = publishScript.split(/\s+/)

        // 배포 스크립트 실행
        const changesetPublishOutput = await getExecOutput(publishCommand, [...publishArgs], {cwd})

        // 배포된 패키지들의 정보와 배포 메세지를 가져옵니다
        const {message, publishedPackages} = getPublishedPackageInfos({
            execOutput: changesetPublishOutput,
            packagesDir,
            language,
        })

        const createRelease = core.getBooleanInput('create_release')

        createRelease &&
            (await createReleaseForTags({
                tags: publishedPackages.map(({name, version}) => `${name}@${version}`),
                baseSha: pullRequestInfo.base.sha,
                headSha: pullRequestInfo.head.sha,
            }))

        // 배포 완료 코멘트
        await issueFetchers.addComment(message)

        // output 설정
        core.setOutput('published', 'true')
        core.setOutput('publishedPackages', JSON.stringify(publishedPackages))
        core.setOutput('message', message)
    } catch (e) {
        core.error((e as Error)?.message)
        issueFetchers.addComment(LANGUAGES[language].error)
        process.exit(1) // close with error
    }
}

main()
