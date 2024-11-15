import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'

import {commitAll, getChangedAllFiles, getOctokitRestCommonParams, push} from '$actions/utils'

import {CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM} from './constants'
import {getChangedPackagesGithubComment, getChangesetEmptyGithubComment} from './utils/changeset'
import {getChangedPackages} from './utils/file'

async function main() {
    const context = github.context

    const {pull_request} = context.payload

    if (!pull_request) {
        return
    }

    const {owner, repo} = getOctokitRestCommonParams()
    const {number: pullNumber} = pull_request

    const githubToken = core.getInput('github_token')
    const octokit = github.getOctokit(githubToken)

    /**
     * 변경된 파일 이름을 가져오기위한 api
     * TODO: lib/apis/issueFetch 로 이동
     */
    const {data: comments} = await octokit.rest.issues.listComments({owner, repo, issue_number: pullNumber})

    const prevComment = comments.find(
        (comment) => comment?.body && comment.body.includes(CHANGESET_DETECT_ADD_ACTIONS_CHECKSUM),
    )

    // skipLabel 룰에 따라 스킵처리한다.
    const skipLabel = core.getInput('skip_label')
    const isSkipByLabel = ((pull_request?.labels as {name: string}[]) || []).some(({name}) => name === skipLabel)

    if (isSkipByLabel) {
        core.info(
            `skip_label에 해당하는 label이 해당 PR에 추가되어 있어, 해당 PR에서는 ci를 스킵합니다. (해당 라벨 : ${skipLabel})`,
        )
        if (prevComment) {
            await octokit.rest.issues.deleteComment({owner, repo, comment_id: prevComment.id}).catch(() => {})
        }
        return
    }

    // skipBranch 룰에 따라 스킵처리한다. (정의된 skip branch 거나 changeset-release 를 포함한다면)
    const skipBranches =
        typeof core.getInput('skip_branches') === 'string' ? core.getInput('skip_branches').split(',') : []
    const isSkippedBaseBranch =
        skipBranches.includes(pull_request.base.ref) && (pull_request?.head?.ref || '').startsWith('changeset-release/')
    if (isSkippedBaseBranch) {
        core.info(
            `base 브랜치가 ${pull_request.base.ref} 이거나, head 브랜치가 ${pull_request?.head?.ref} 여서 detectAdd를 스킵합니다.`,
        )
        return
    }

    /**
     * 변경된 파일 이름을 가져오기위한 api
     */

    const packages_dir = core.getInput('packages_dir')
    const excludes = core.getInput('excludes') ?? ''

    if (typeof packages_dir !== 'string') {
        throw new Error(
            `해당 action에 주입된 packages_dir parameter가 잘못되었습니다. (string, string1)의 형식으로 작성해주세요.`,
        )
    }

    // 변경된 모든 파일을 가져온다.
    const allChangedFiles = await getChangedAllFiles({pullNumber})

    // formatting_script 가 존재하고 변경된 파일중에 .changeset/*.md 가 존재한다면
    const formattingScript = core.getInput('formatting_script')

    if (
        formattingScript != null &&
        allChangedFiles.some(({filename}) => filename.startsWith('.changeset/') && filename.endsWith('.md'))
    ) {
        const currentBranch = process.env.GITHUB_HEAD_REF as string

        try {
            // formatting 명령어 실행
            await exec('sh', ['-c', formattingScript])
        } catch (e) {
            // nothing..
        }

        try {
            // 저장소가 clean 한지 체크하고 commit 메시지를 추가 후 푸시합니다.
            await commitAll(`🔨 fix: resolve lint (auto-fix)`)
            await push(currentBranch, {force: true})
        } catch (e) {
            // nothing..
        }
    }

    // 변경된 파일들중에 packagesDir 내부에 파일만 골라낸다. (이때 .md 는 무시한다)
    // TODO(new-jeans): 확장자를 외부에서 받아서 필터링 할 수 있도록
    // 변경된 파일들중에 packagesDir 내부에 파일만 골라낸다. (이때 .md 는 무시한다)
    const changedPackages = await getChangedPackages({
        changedFiles: allChangedFiles,
        packagesDir: packages_dir.split(',').map((v) => v.trim()) as string[],
        excludes: excludes.split(',') as string[],
    })

    // 변경된 패키지가 없다면 Empty 메시지를 남긴다.
    if (changedPackages.length === 0) {
        if (prevComment !== undefined) {
            await octokit.rest.issues.updateComment({
                owner,
                repo,
                issue_number: pullNumber,
                body: getChangesetEmptyGithubComment(),
                comment_id: prevComment.id,
            })
        } else {
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: pullNumber,
                body: getChangesetEmptyGithubComment(),
            })
        }

        return
    }

    // 변경된 패키지들의 정보를 바탕으로 메시지를 생성한다.
    const comment = getChangedPackagesGithubComment({
        changedPackages,
        pullRequest: pull_request,
        skipLabel,
    })

    if (prevComment !== undefined) {
        await octokit.rest.issues.updateComment({
            owner,
            repo,
            issue_number: pullNumber,
            body: comment,
            comment_id: prevComment.id,
        })
    } else {
        await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pullNumber,
            body: comment,
        })
    }

    // detect add 정보가 없다면 action 을 실패처리하고 가이드 메시지를 보여준다.
    if (!allChangedFiles.some(({filename}) => filename.includes('.changeset'))) {
        core.setFailed(
            `comment의 지침에 따라, .changeset 파일을 추가해주세요. ${
                skipLabel
                    ? `만약, 버전변경이 필요 없다면 ${skipLabel}을 label에 추가해주세요.`
                    : '만약, 버전변경이 필요 없다면 해당 ci는 무시해주세요.'
            }`,
        )
    }
}

main()
