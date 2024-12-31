// usage: npx nodemon -e "ts" src/index.ts
import { config } from '@dotenvx/dotenvx'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

config()

const FRIGATE_SERVER = process.env.FRIGATE_SERVER
const TIMEZONE = process.env.TIMEZONE
const FFMPEG = process.env.FFMPEG
const FROM_DAYS_AGO = parseInt(process.env.FROM_DAYS_AGO ?? "14")

if (!FRIGATE_SERVER) {
    console.log(`configure FRIGATE_SERVER in .env`)
    process.exit(1)
}

export type FrigateEvent = {
    id: string
}

const exists = (filename: string) => {
    try {
        return fs.existsSync(filename)
    } catch (e) {
        console.error(e)
    }
    return false
}

const getUrlToFile = async (url: string, folder: string, filename: string, headers?: Record<string, string>): Promise<void> => {
    let outputPath = [folder, filename].join('/')

    if (exists(outputPath))
        return

    console.log(`get ${outputPath}`)

    let response = await fetch(url, { headers })
    let buffer = await response.arrayBuffer()

    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(outputPath, new Uint8Array(buffer), { encoding: 'binary' } )
}

const getFFmpegToFile = async (url: string, folder: string, filename: string, headers?: Record<string, string>): Promise<void> => {
    
    let outputPath = [folder, filename].join('/')

    if (exists(outputPath))
        return

    console.log(`get ${outputPath}`)
    fs.mkdirSync(folder, { recursive: true })

    execSync(`${FFMPEG} -i ${url} -c copy ${outputPath}`)

}

const getThumbnail = async (event: FrigateEvent) => {
    await getUrlToFile(`${FRIGATE_SERVER}/api/events/${event.id}/thumbnail.jpg`, `thumbnails`,  `${event.id}.jpg`, {
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "Referer": `${FRIGATE_SERVER}/events`,
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    )
}

const getSnapshot = async (event: FrigateEvent) => {
    await getUrlToFile(`${FRIGATE_SERVER}/api/events/${event.id}/snapshot.jpg?bbox=0`, `snapshots`, `${event.id}.jpg`, {
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "Referer": `${FRIGATE_SERVER}/events`,
        "Referrer-Policy": "strict-origin-when-cross-origin"
    })
}

const getClip = async (event: FrigateEvent) => {
    await getUrlToFile(`${FRIGATE_SERVER}/api/events/${event.id}/clip.mp4?download=true`, `clips`, `${event.id}.mp4`)
}

const delay = async(timeout: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, timeout);
    })
}

const getRecordings = async (fromDaysAgo: number) => {
    let start = Date.now() - (fromDaysAgo * 86400000)
    let hour_as_ms = 3600000

    for (let day = 0; day < fromDaysAgo; day++) {
        for (let hour = 0; hour < 24; hour++) {
            let date = new Date(start)

            let date_formatted = `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
            let hours_formatted = date.getHours().toString().padStart(2, '0')
            let path = `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.${hours_formatted}.ts` // script will restart in dev mode

            let recordingUrl = `${FRIGATE_SERVER}/vod/${date_formatted}/${hours_formatted}/side/Australia,Sydney/master.m3u8`

            console.log(`recording url: ${recordingUrl}`)
            if (start < Date.now() - hour_as_ms) {
                try {
                    await getFFmpegToFile(recordingUrl, `recordings`, path)
                } catch (e) {
                    console.error(e)
                    await delay(200)
                }
            }

            start += hour_as_ms
        }
    }
}

const main = async (argv: string[]) => {
    let eventsUrl = `${FRIGATE_SERVER}/api/events?cameras=all&labels=all&zones=all&sub_labels=all&time_range=00:00,24:00&timezone=${TIMEZONE}&favorites=0&is_submitted=-1&in_progress=0&include_thumbnails=0&limit=1000`

    let eventsResponse = await fetch(eventsUrl)
    
    let eventsString = await eventsResponse.text()

    fs.mkdirSync('events', { recursive: true })
    fs.writeFileSync(`events/${Date.now()}.json`, eventsString, 'utf8')

    let events: Array<FrigateEvent> = JSON.parse(eventsString)

    console.log(`Events:`, events.length)

    for (let event of events) {
        // console.log(event)
        try {
            await getThumbnail(event)
            await getSnapshot(event)
            await getClip(event)
        } catch (e) {
            console.error(e)
        }
        // break
    }

    try {
        await getRecordings(FROM_DAYS_AGO)
    } catch (e) {
        console.error(e)
    }
}

main(process.argv.slice(2))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
