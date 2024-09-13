import {MAX_CHARACTERS_PER_MESSAGE} from '../constants'

interface GetMessageOptions {
    changedPackagesInfo: {
        highestLevel: number
        private: boolean
        content: string
        header: string
    }[]
}

export async function geneatePrBody({changedPackagesInfo}: GetMessageOptions) {
    const messageReleasesHeading = `# Releases`

    let fullMessage = [
        messageReleasesHeading,
        ...changedPackagesInfo.map((info) => `${info.header}\n\n${info.content}`),
    ].join('\n')

    // 메시지가 크기 제한 체크
    if (fullMessage.length > MAX_CHARACTERS_PER_MESSAGE) {
        fullMessage = [
            messageReleasesHeading,
            `\n> 패키지 변경 로그가 ${MAX_CHARACTERS_PER_MESSAGE}자를 초과하여, 각 패키지의 변경 정보가 생략됩니다.\n`,
            ...changedPackagesInfo.map((info) => `${info.header}\n\n`),
        ].join('\n')
    }

    // 메시지가 크기 제한 다시 체크
    // 최대 크기를 초과한다면 모든 릴리즈 내용 생략
    if (fullMessage.length > MAX_CHARACTERS_PER_MESSAGE) {
        fullMessage = [
            messageReleasesHeading,
            `\n> 패키지 변경 로그가 ${MAX_CHARACTERS_PER_MESSAGE}자를 초과하여, 모든 패키지의 릴리즈 정보가 생략됩니다.\n`,
        ].join('\n')
    }

    return fullMessage
}
