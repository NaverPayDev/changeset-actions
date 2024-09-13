// TODO: 공통 유틸 리팩터링
export function uniqBy<T>(arr: T[], hasher: (value: T) => unknown): T[] {
    const result: T[] = []
    const addedElements = new Set<unknown>()

    for (const item of arr) {
        const hash = hasher(item)

        if (addedElements.has(hash)) {
            continue
        }

        addedElements.add(hash)
        result.push(item)
    }

    return result
}
