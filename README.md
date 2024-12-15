# Frigate-Sync

Export event data from your [Frigate](https://frigate.video/) instance


## Usage

Install dependencies:
```sh
yarn
```

Create .env:
```sh
echo "FRIGATE_SERVER=\"http://myfrigate.example.com\"" > .env
```

Run:
```sh
yarn run sync
```

Add to crontab etc for automation.

Downloaded data is written to:
```
clips
events
snapshots
thumbnails
```

## Note

Snapshots include bounding boxes in the version of Frigate I tested with (`0.13.2-6476f8a`), despite using bbox=0 on the snapshot request.
As such, thumbnails will be more reliable for training data. 

### TODO
[ ] Extract snapshots from clips based on event data.
