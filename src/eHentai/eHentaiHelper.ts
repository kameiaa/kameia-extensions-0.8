import {
    PartialSourceManga,
    RequestManager
} from '@paperback/types'

import { UrlInfo, parseMenuListPage, parseUrlParams } from './eHentaiParser'

export async function getGalleryData(ids: string[], requestManager: RequestManager): Promise<any> {
    let resulting = ids.map(id => id.split('/'))
    for (const result of resulting) {
        for (const result1 of result) {
            console.log(result1)
        }
    }
    const request = App.createRequest({
        url: 'https://api.e-hentai.org/api.php',
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        data: {
            'method': 'gdata',
            'gidlist': ids.map(id => id.split('/')),
            'namespace': 1
        }
    })

    const data = await requestManager.schedule(request, 1)
    const json = (typeof data.data == 'string') ? JSON.parse(data.data.replaceAll(/[\r\n]+/g, ' ')) : data.data
    return await json.gmetadata
}

export async function getSearchData(query: string | undefined, page: number, categories: number, requestManager: RequestManager, cheerio: CheerioAPI, nextPageId: { id: number }): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
        url: `https://e-hentai.org/?next=${page}&f_cats=${categories}&f_search=${encodeURIComponent(query ?? '')}`,
        method: 'GET'
    })
    const result = await requestManager.schedule(request, 1)
    const $ = cheerio.load(result.data as string)

    let urlInfo: UrlInfo = parseUrlParams($('#unext').attr('href') ?? '')
    nextPageId.id = urlInfo.id

    return parseMenuListPage($)
}

export function getRowDetails($: CheerioStatic, manga: CheerioElement, info: { id: string, title: string, image: string, subtitle: string }) {
    info.id = idCleaner($('td.gl3c.glname', manga).contents().attr('href') ?? '/////')
    info.title = $('.glink', manga).text().trim()
    let imageObj: Cheerio | undefined = $(['div#it', info.id.split('/')[0],' div img'].join(''))
    const dataSrc = imageObj.attr('data-src')
    if ((typeof dataSrc != 'undefined')) {
        info.image = dataSrc
    } else {
        info.image = imageObj.attr('src') as string
    }
    info.subtitle = $('td.gl1c.glcat', manga).text().trim()
    return info
}

export function idCleaner(str: string | null): string {
    const splitUrlContents = str?.split('/')
    if (splitUrlContents == null) {
        return `1`
    }
    
    return `${splitUrlContents[4]}/${splitUrlContents[5]}`
}
