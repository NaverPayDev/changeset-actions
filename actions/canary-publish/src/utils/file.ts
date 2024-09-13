import * as core from '@actions/core'
import fg from 'fast-glob'
import fs from 'fs-extra'

import {getChangedAllFiles} from '$actions/utils'

export async function getChangedPackages({pullNumber, packagesDir}: {pullNumber: number; packagesDir: string[]}) {
    const changedFiles = await getChangedAllFiles({
        pullNumber,
    })

    const changedPackages = changedFiles.reduce((acc, {filename}) => {
        const isTargetDirectories = packagesDir.some((packageDir) => filename.includes(`${packageDir}/`))
        const isMarkdownFile = filename.endsWith('.md')

        if (isTargetDirectories && !isMarkdownFile) {
            const [packageRoot, packageName] = filename.split('/')
            const packageJsonPath = [packageRoot, packageName, 'package.json'].join('/')

            acc.push(packageJsonPath)
        }
        return acc
    }, [] as string[])

    return [...new Set(changedPackages)]
}

export async function getAllPackageJSON() {
    const paths = await fg('**/package.json', {
        ignore: ['**/node_modules/**'],
    })

    return paths
}

export async function protectUnchangedPackages(changedPackages: string[]) {
    const allPackageJSON = await getAllPackageJSON()

    for (const packageJsonPath of allPackageJSON) {
        if (!changedPackages.includes(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

            core.info(`🔨 [${packageJson.name}] private:true 를 추가합니다`)

            packageJson.private = true

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
        }
    }
}
