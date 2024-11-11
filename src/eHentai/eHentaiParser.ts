import {
    HomeSection,
    PartialSourceManga,
    RequestManager,
    SourceStateManager,
    TagSection
} from '@paperback/types'

import entities = require('entities')

import {
    getRowDetails
} from './eHentaiHelper'

import {
    getDisplayedCategories,
    getExtraArgs
} from './eHentaiSettings'

export const parseArtist = (tags: string[]): string | undefined => {
    const artist = tags.filter(tag => tag.startsWith('artist:')).map(tag => tag.substring(7))
    const cosplayer = tags.filter(tag => tag.startsWith('cosplayer:')).map(tag => tag.substring(10))

    if (artist.length != 0) {
        return artist[0]
    }
    else if (cosplayer.length != 0) {
        return cosplayer[0]
    }

    return undefined
}

export const parseLanguage = (tags: string[]): string => {
    const languageTags = tags.filter(tag => tag.startsWith('language:') && tag != 'language:translated').map(tag => tag.substring(9))

    if (languageTags.length == 0 || languageTags[0] == null) {
        return "unknown";
    }

    return languageTags.join(", ")
}

async function getImage(url: string, requestManager: RequestManager, cheerio: CheerioAPI): Promise<string> {
    const request = App.createRequest({
        url: url,
        method: 'GET'
    })

    const data = await requestManager.schedule(request, 1)
    const $ = cheerio.load(data.data as string)

    return $('#img').attr('src') ?? ''
}

export async function parsePage(id: string, page: number, requestManager: RequestManager, cheerio: CheerioAPI): Promise<string[]> {
    const request = App.createRequest({
        url: `https://e-hentai.org/g/${id}/?p=${page}`,
        method: 'GET'
    })

    const response = await requestManager.schedule(request, 1)
    const $ = cheerio.load(response.data as string)

    const pageArr = []
    const pageDivArr = $('#gdt a').toArray()

    console.log(pageDivArr.length)
    for (const pageDiv of pageDivArr) {
        pageArr.push(getImage($(pageDiv).attr('href') ?? '', requestManager, cheerio))
    }

    return Promise.all(pageArr)
}

export async function parsePages(mangaId: string, pageCount: string, requestManager: RequestManager, cheerio: CheerioAPI): Promise<string[]> {
    const splitPageCount: string[] = pageCount.split('-')

    if ((splitPageCount[0] ?? '0') == 'Full') {
        if (splitPageCount.length != 3) {
            return []
        }

        const pages: number = parseInt(splitPageCount[1] ?? '0')
        const imagesPerPage: number = parseInt(splitPageCount[2] ?? '0')
        const loopAmt: number = pages / imagesPerPage
        const pagesArr = []
        for (let i = 0; i <= loopAmt; i++) {
            pagesArr.push(parsePage(mangaId, i, requestManager, cheerio))
        }
        return Promise.all(pagesArr).then(pages => pages.reduce((prev, cur) => [...prev, ...cur], []))
    } else if ((splitPageCount[0] ?? '0') == 'Pages') {
        if (splitPageCount.length != 2) {
            return []
        }
        const websitePageNum: number = parseInt(splitPageCount[1] ?? '0')
        return parsePage(mangaId, websitePageNum, requestManager, cheerio)
    }

    return []
}

const namespaceHasTags = (namespace: string, tags: string[]): boolean => { return tags.filter(tag => tag.startsWith(`${namespace}:`)).length != 0 }

const createTagSectionForNamespace = (namespace: string, tags: string[]): TagSection => { return App.createTagSection({ id: namespace, label: namespace, tags: tags.filter(tag => tag.startsWith(`${namespace}:`)).map(tag => App.createTag({ id: tag, label: tag.substring(namespace.length + 1) })) }) }

export const parseTags = (tags: string[]): TagSection[] => {
    const tagSectionArr = []

    switch (tags.shift()) {
        case 'Doujinshi': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:2', label: 'Doujinshi' })] })); break
        case 'Manga': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:4', label: 'Manga' })] })); break
        case 'Artist CG': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:8', label: 'Artist CG' })] })); break
        case 'Game CG': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:16', label: 'Game CG' })] })); break
        case 'Non-H': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:256', label: 'Non-H' })] })); break
        case 'Image Set': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:32', label: 'Image Set' })] })); break
        case 'Western': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:512', label: 'Western' })] })); break
        case 'Cosplay': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:64', label: 'Cosplay' })] })); break
        case 'Asian Porn': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:128', label: 'Asian Porn' })] })); break
        case 'Misc': tagSectionArr.push(App.createTagSection({ id: 'categories', label: 'categories', tags: [App.createTag({ id: 'category:1', label: 'Misc' })] })); break
    }

    if (namespaceHasTags('character', tags)) tagSectionArr.push(createTagSectionForNamespace('character', tags))
    if (namespaceHasTags('female', tags)) tagSectionArr.push(createTagSectionForNamespace('female', tags))
    if (namespaceHasTags('male', tags)) tagSectionArr.push(createTagSectionForNamespace('male', tags))
    if (namespaceHasTags('mixed', tags)) tagSectionArr.push(createTagSectionForNamespace('mixed', tags))
    if (namespaceHasTags('other', tags)) tagSectionArr.push(createTagSectionForNamespace('other', tags))
    if (namespaceHasTags('parody', tags)) tagSectionArr.push(createTagSectionForNamespace('parody', tags))

    return tagSectionArr
}

export const parseTitle = (title: string): string => {
    return title.replaceAll(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
}

export async function parseHomeSections(cheerio: CheerioAPI, requestManager: RequestManager, sections: HomeSection[], sectionCallback: (section: HomeSection) => void, sourceStateManager: SourceStateManager): Promise<void> {
    for (const section of sections) {
        let $: CheerioStatic | undefined = undefined

        if (section.id == 'popular_recently') {
            $ = await getCheerioStatic(cheerio, requestManager, 'https://e-hentai.org/popular')
            if ($ != null) {
                section.items = parseMenuListPage($, true)
            }
        }

        if (section.id == 'latest_galleries') {
            const displayedCategories: number[] = await getDisplayedCategories(sourceStateManager)
            const excludedCategories: number = displayedCategories.reduce((prev, cur) => prev - cur, 1023)
            $ = await getCheerioStatic(cheerio, requestManager, 'https://e-hentai.org/?f_cats=' + excludedCategories + '&f_search=' + encodeURIComponent(await getExtraArgs(sourceStateManager)))
            if ($ != null) {
                section.items = parseMenuListPage($)
            }
        }

        if ($ == null) {
            section.items = [App.createPartialSourceManga({
                mangaId: 'stopSearch',
                image: '',
                title: '',
                subtitle: ''
            })]
        }
        sectionCallback(section)
    }
}

export function parseMenuListPage($: CheerioStatic, ignoreExpectedEntryAmount: boolean = false): PartialSourceManga[] {
    let skippedFirstRow = false
    let ret: PartialSourceManga[] = []

    for (const manga of $('tr', 'table.itg.gltc').toArray()) {
        if (!skippedFirstRow) {
            skippedFirstRow = true
            continue
        }

        let id: string = '', title: string = '', image: string = '', subtitle: string = ''
        let details = { id, title, image, subtitle }
        getRowDetails($, manga, details);

        if (details.id.length == 0 || details.title.length == 0) {
            continue
        }

        ret.push(App.createPartialSourceManga({
            mangaId: details.id,
            image: details.image,
            title: entities.decodeHTML(details.title),
            subtitle: entities.decodeHTML(details.subtitle)
        }))
    }

    if (!ignoreExpectedEntryAmount && (ret.length == 0 || ret.length != 25)) {
        ret.push(App.createPartialSourceManga({
            mangaId: 'stopSearch',
            image: '',
            title: '',
            subtitle: ''
        }))
    }
    return ret
}

export async function getCheerioStatic(cheerio: CheerioAPI, requestManager: RequestManager, urlParam: string): Promise<CheerioStatic> {
    const request = App.createRequest({
        url: urlParam,
        method: 'GET'
    })

    const response = await requestManager.schedule(request, 1)
    return cheerio.load(response.data as string)
}

export interface UrlInfo {
    id: number,
    query: string,
    category: number
}

export function parseUrlParams(url: string) : UrlInfo {
    let ret = { id: 0, query: '', category: 0 }
    let trimmed = url.substring(22)

    let splitTrimmed = trimmed.split('&')

    for (const element of splitTrimmed) {
        let varValue = element.split('=')

        if (varValue[1] == null) {
            continue
        }

        if (varValue[0] == 'next') {
            ret.id = parseInt(varValue[1])
        }

        if (varValue[0] == 'f_search') {
            ret.query = varValue[1]
        }

        if (varValue[0] == 'f_cats') {
            ret.category = parseInt(varValue[1])
        }
    }

    return ret
}
