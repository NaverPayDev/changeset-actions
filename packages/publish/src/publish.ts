import {getExecOutput} from '@actions/exec'
import {getPackages, Package} from '@manypkg/get-packages'

import {getOctokitRestCommonParams, pushTags} from '$actions/utils'

import {createReleaseTag} from './utils/git'
import {uniqBy} from './utils/uniqBy'

const cwd = process.cwd()

interface PublishOptions {
    publishScript: string
    createGithubReleaseTag: boolean
}

interface PublishedPackage {
    name: string
    version: string
}

type PublishResult =
    | {
          published: true
          publishedPackages: PublishedPackage[]
          message: string
      }
    | {
          published: false
      }

export async function runPublish({publishScript, createGithubReleaseTag}: PublishOptions): Promise<PublishResult> {
    const {owner, repo} = getOctokitRestCommonParams()

    // publish 명령어 실행
    const [publishCommand, ...publishArgs] = publishScript.split(/\s+/)

    const changesetPublishOutput = await getExecOutput(publishCommand, publishArgs, {cwd})

    await pushTags()

    // 패키지 정보와 환경에 따라 변경사항을 분석하고, 패키지에 대한 GitHub 릴리즈 태그를 생성
    const {packages, tool} = await getPackages(cwd)
    const releasedPackages: Package[] = []

    if (tool !== 'root') {
        const newTagRegex = /New tag:\s+(@[^/]+\/[^@]+|[^/]+)@([^\s]+)/
        const packagesByName = new Map(packages.map((x) => [x.packageJson.name, x]))

        for (const line of changesetPublishOutput.stdout.split('\n')) {
            const match = line.match(newTagRegex)
            if (match === null) {
                continue
            }
            const pkgName = match[1]
            const pkg = packagesByName.get(pkgName)

            if (pkg === undefined) {
                throw new Error(`${pkgName} 패키지를 찾을 수 없습니다`)
            }

            releasedPackages.push(pkg)
        }

        // 태그를 생성하길 원한다면 배포된 패키지를 순회하며 태그를 생성한다.
        if (createGithubReleaseTag) {
            await Promise.all(
                releasedPackages.map((pkg) =>
                    createReleaseTag({
                        pkg,
                        tagName: `${pkg.packageJson.name}@${pkg.packageJson.version}`,
                    }),
                ),
            )
        }
    } else {
        if (packages.length === 0) {
            throw new Error(`패키지를 찾을 수 없습니다.`)
        }

        const pkg = packages[0]
        const newTagRegex = /New tag:/

        for (const line of changesetPublishOutput.stdout.split('\n')) {
            const match = line.match(newTagRegex)

            if (match) {
                releasedPackages.push(pkg)
                if (createGithubReleaseTag) {
                    await createReleaseTag({
                        pkg,
                        tagName: `v${pkg.packageJson.version}`,
                    })
                }
                break
            }
        }
    }

    // 배포가 완료된 패지키들에 대한 메세지를 생성합니다
    const publishedPackages = releasedPackages.map((pkg) => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
    }))

    const message = uniqBy(publishedPackages, ({name}) => name)
        .map(
            ({name, version}) =>
                `- ${name}@${version}\nhttps://oss.fin.navercorp.com/${owner}/${repo}/releases/tag/${name}@${version}`,
        )
        .join('\n')

    if (releasedPackages.length) {
        return {
            published: true,
            publishedPackages,
            message: JSON.stringify(message),
        }
    }

    return {published: false}
}
