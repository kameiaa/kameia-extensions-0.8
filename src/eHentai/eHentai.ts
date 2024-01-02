import {
    BadgeColor,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    ContentRating,
    HomePageSectionsProviding,
    HomeSectionType,
    HomeSection,
    MangaInfo,
    MangaProviding,
    PagedResults,
    Request,
    RequestManager,
    Response,
    SearchRequest,
    SearchResultsProviding,
    SourceInfo,
    SourceManga,
    TagSection,
    SourceIntents
} from '@paperback/types'

import {
    getGalleryData,
    getSearchData
} from './eHentaiHelper'

import {
    parseArtist,
    parseLanguage,
    parsePages,
    parseTags,
    parseTitle,
    parseHomeSections
} from './eHentaiParser'

export const eHentaiInfo: SourceInfo = {
    version: '0.8.0',
    name: 'e-hentai',
    icon: 'icon.png',
    author: 'kameia, loik',
    description: 'Extension to grab galleries from E-Hentai',
    contentRating: ContentRating.ADULT,
    websiteBaseURL: 'https://e-hentai.org',
    authorWebsite: 'https://github.com/kameiaa',
    sourceTags: [{
        text: '18+',
        type: BadgeColor.YELLOW
    }],
    intents: SourceIntents.HOMEPAGE_SECTIONS
}

export class eHentai implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {

    constructor(public cheerio: CheerioAPI) { }

    readonly requestManager: RequestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 15000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'user-agent': await this.requestManager.getDefaultUserAgent(),
                        'referer': 'https://e-hentai.org/'
                    }
                }
                request.cookies = [App.createCookie({ name: 'nw', value: '1', domain: 'https://e-hentai.org/' })]
                return request
            },

            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    })

    stateManager = App.createSourceStateManager();

    getMangaShareUrl(mangaId: string): string {
        return `https://e-hentai.org/g/${mangaId}`
    }

    async getSearchTags(): Promise<TagSection[]> {
        const categoriesTagSection: TagSection = App.createTagSection({
            id: 'categories', label: 'Categories', tags: [
                App.createTag({ id: 'category:2', label: 'Doujinshi' }),
                App.createTag({ id: 'category:4', label: 'Manga' }),
                App.createTag({ id: 'category:8', label: 'Artist CG' }),
                App.createTag({ id: 'category:16', label: 'Game CG' }),
                App.createTag({ id: 'category:256', label: 'Non-H' }),
                App.createTag({ id: 'category:32', label: 'Image Set' }),
                App.createTag({ id: 'category:512', label: 'Western' }),
                App.createTag({ id: 'category:64', label: 'Cosplay' }),
                App.createTag({ id: 'category:128', label: 'Asian Porn' }),
                App.createTag({ id: 'category:1', label: 'Misc' })
            ]
        })
        const tagSections: TagSection[] = [categoriesTagSection]
        return tagSections
    }

    async supportsTagExclusion(): Promise<boolean> {
        return true
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section_popular_recently = App.createHomeSection({ id: 'popular_recently', title: 'Popular Recently', type: HomeSectionType.singleRowNormal, containsMoreItems: false })
        const section_latest_galleries = App.createHomeSection({ id: 'latest_galleries', title: 'Latest Galleries', type: HomeSectionType.singleRowNormal, containsMoreItems: true })
        const sections: HomeSection[] = [section_popular_recently, section_latest_galleries]

        await parseHomeSections(this.cheerio, this.requestManager, sections, sectionCallback)

        // if (section_latest_galleries.items == null) {
        //     console.log('latest galleries are null')
        //     return
        // }

        // if (section_latest_galleries.items.length == 0) {
        //     console.log('latest galleries are empty')
        //     return
        // }

        // let tempid = section_latest_galleries.items[0]?.mangaId
        // if (tempid == null) {
        //     console.log('aborting, no id')
        //     return
        // }
        // console.log('using manga id of ' + tempid)
        // let chapters: Chapter[] = await this.getChapters(tempid)
        // for (const chapter of chapters) {
        //     console.log('chapter exists with id of ' + chapter.id)
        //     let details = await this.getChapterDetails('1803120/eff7d824b7', chapter.id)
        //     for (const page of details.pages) {
        //         console.log('img link: ' + page)
        //     }
        // }
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        let stopSearch = metadata?.stopSearch ?? false
        if(stopSearch) return App.createPagedResults({
            results: [],
            metadata: {
                stopSearch: true
            }
        })

        let nextPageId = { id: 0 }
        const results = await getSearchData('', page, 1023 - parseInt(homepageSectionId.substring(9)), this.requestManager, this.cheerio, nextPageId)
        if (results[results.length - 1]?.mangaId == 'stopSearch') {
            results.pop()
            stopSearch = true
        }

        return App.createPagedResults({
            results: results,
            metadata: {
                page: nextPageId.id ?? 0,
                stopSearch: stopSearch
            }
        })
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const data = (await getGalleryData([mangaId], this.requestManager))[0]
        let languageStr: string = parseLanguage(data.tags)
        let mangaDetails: MangaInfo = App.createMangaInfo({
            titles: [parseTitle(data.title), parseTitle(data.title_jpn)],
            image: data.thumb,
            rating: data.rating,
            status: 'Completed',
            artist: parseArtist(data.tags),
            desc: ['Pages: ', data.filecount, ' | Language: ', languageStr,' | Rating: ', data.rating, ' | Uploader: ', data.uploader].join(''),
            tags: parseTags([data.category, ...data.tags]),
            hentai: !(data.category == 'Non-H' || data.tags.includes('other:non-nude'))
        })

        return App.createSourceManga({id: mangaId, mangaInfo: mangaDetails})
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        let data = (await getGalleryData([mangaId], this.requestManager))[0]
        console.log(data)
        return [App.createChapter({
            id: data.filecount,
            name: 'Chapter 1',
            chapNum: 1,
            time: new Date(parseInt(data.posted) * 1000),
            volume: 0,
            sortingIndex: 1
        })]
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: await parsePages(mangaId, parseInt(chapterId), this.requestManager, this.cheerio)
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        let stopSearch = metadata?.stopSearch ?? false
        if (stopSearch) {
            return App.createPagedResults({
                results: undefined,
                metadata: {
                    stopSearch: true
                }
            })
        }

        const includedCategories = query.includedTags?.filter(tag => tag.id.startsWith('category:'))
        const excludedCategories = query.excludedTags?.filter(tag => tag.id.startsWith('category:'))
        let categories = 0
        if (includedCategories != undefined && includedCategories.length != 0) {
            categories = includedCategories.map(tag => parseInt(tag.id.substring(9))).reduce((prev, cur) => prev - cur, 1023)
        }
        else if (excludedCategories != undefined && excludedCategories.length != 0) {
            categories = excludedCategories.map(tag => parseInt(tag.id.substring(9))).reduce((prev, cur) => prev + cur, 0)
        }

        if (Number.isNaN(categories)) {
            categories = 1023
        }

        let nextPageId = { id: 0 }
        const results = await getSearchData(query.title, page, categories, this.requestManager, this.cheerio, nextPageId)
        if (results[results.length - 1]?.mangaId == 'stopSearch') {
            results.pop()
            stopSearch = true
        }

        return App.createPagedResults({
            results: results,
            metadata: {
                page: nextPageId.id ?? 0,
                stopSearch: stopSearch
            }
        })
    }
}
