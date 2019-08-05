#!/bin/bash

# Check crontab: 0 * * * * /home/clearlydefined/run.sh > Run.log

declare -i RUNNING_NODE_PROCS=`top -bn1 | grep node | wc -l`
echo === Running node processes: $RUNNING_NODE_PROCS ===

LOCAL_IMAGE_DATE=`docker inspect --format "{{json .Created}}" clearlydefined/crawler:latest`
LOCAL_IMAGE_HOUR=${LOCAL_IMAGE_DATE:0:14}\"
echo === Local image date: $LOCAL_IMAGE_DATE    hour: $LOCAL_IMAGE_HOUR ===

REMOTE_IMAGE_DATE=$(curl -s https://registry.hub.docker.com/v2/repositories/clearlydefined/crawler/tags/latest/ | grep -Po '"last_updated":.*?[^\\]",' | awk -F ': ' '{print $2}')
REMOTE_IMAGE_HOUR=${REMOTE_IMAGE_DATE:0:14}\"
echo === Remote image date: $REMOTE_IMAGE_DATE  hour: $REMOTE_IMAGE_HOUR ===

CURRENT_HOUR=`date +"%H"`
echo === Current hour: $CURRENT_HOUR ===

restart_crawlers() {
  declare -i CRAWLERS_NUM=36
  echo === Killing Docker containers: ===
  docker kill $(docker ps -q)
  echo === Removing exited containers: ===
  docker rm $(docker ps -q -all)
  if [ $LOCAL_IMAGE_HOUR != $REMOTE_IMAGE_HOUR ]
  then
          echo === Removing the old container ===
          docker rmi clearlydefined/crawler:latest -f
  fi
  echo === Starting $CRAWLERS_NUM containers: ===
  for ((i=0; i<$CRAWLERS_NUM; i++))
  do
        docker run \
                --restart=always \
                --detach \
                -e CRAWLER_AZBLOB_CONNECTION_STRING='<secret>' \
                -e CRAWLER_GITHUB_TOKEN='<secret>' \
                -e CRAWLER_HOST='<name>' \
                -e CRAWLER_INSIGHTS_KEY='<key>' \
                -e CRAWLER_SERVICE_AUTH_TOKEN='<secret>' \
                -e CRAWLER_SERVICE_URL='https://cdcrawler-prod.azurewebsites.net' \
                -e CRAWLER_WEBHOOK_TOKEN='<secret>' \
                -e HARVEST_AZBLOB_CONNECTION_STRING='<secret>' \
                clearlydefined/crawler:latest
  done
}

# Restart crawlers if there are no/too few running crawlers or there is a new image or every 4 hours:
if (( $RUNNING_NODE_PROCS < 10)) || [ $LOCAL_IMAGE_HOUR != $REMOTE_IMAGE_HOUR ] || (( $CURRENT_HOUR % 4 == 0 ))
then
        restart_crawlers
else
        echo === Not restarted ===
fi
echo === Done! ===
