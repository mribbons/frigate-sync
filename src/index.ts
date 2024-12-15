// usage: npx nodemon -e "ts" src/index.ts
import { config } from '@dotenvx/dotenvx'
import fs from 'node:fs'

config()

const FRIGATE_SERVER = process.env.FRIGATE_SERVER

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

const main = async (argv: string[]) => {
    let eventsUrl = `${FRIGATE_SERVER}/api/events?cameras=all&labels=all&zones=all&sub_labels=all&time_range=00:00,24:00&timezone=Australia%2FSydney&favorites=0&is_submitted=-1&in_progress=0&include_thumbnails=0&limit=1000`

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
}

main(process.argv.slice(2))
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
