import {getPackages, Package} from '@manypkg/get-packages'
import {toString} from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import unified from 'unified'

import {BUMP_LEVELS} from '../constants'

export async function getCurrentVersions(cwd: string) {
    const {packages} = await getPackages(cwd)

    return new Map(packages.map((x) => [x.dir, x.packageJson.version]))
}

export async function getChangedPackages(cwd: string, previousVersions: Map<string, string>) {
    const {packages} = await getPackages(cwd)
    const changedPackages = new Set<Package>()

    for (const pkg of packages) {
        const previousVersion = previousVersions.get(pkg.dir)
        if (previousVersion !== pkg.packageJson.version) {
            changedPackages.add(pkg)
        }
    }

    return [...changedPackages]
}

export function getChangelogEntry(changelog: string, version: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ast = unified().use(remarkParse).parse(changelog) as any

    let highestLevel: number = BUMP_LEVELS.dep

    const nodes = ast.children
    let headingStartInfo:
        | {
              index: number
              depth: number
          }
        | undefined
    let endIndex: number | undefined

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (node.type === 'heading') {
            const stringified = toString(node)
            const match = stringified.toLowerCase().match(/(major|minor|patch)/)

            if (match !== null) {
                const level = BUMP_LEVELS[match[0] as 'major' | 'minor' | 'patch']
                highestLevel = Math.max(level, highestLevel)
            }

            if (headingStartInfo === undefined && stringified === version) {
                headingStartInfo = {
                    index: i,
                    depth: node.depth,
                }
                continue
            }

            if (endIndex === undefined && headingStartInfo !== undefined && headingStartInfo.depth === node.depth) {
                endIndex = i
                break
            }
        }
    }

    if (headingStartInfo) {
        ast.children = ast.children.slice(headingStartInfo.index + 1, endIndex)
    }

    return {
        content: unified().use(remarkStringify).stringify(ast),
        highestLevel,
    }
}

export function sortByHighestLevel(
    a: {private: boolean; highestLevel: number},
    b: {private: boolean; highestLevel: number},
) {
    if (a.private === b.private) {
        return b.highestLevel - a.highestLevel
    }
    if (a.private) {
        return 1
    }
    return -1
}
