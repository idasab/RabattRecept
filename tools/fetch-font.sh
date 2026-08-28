#!/bin/sh
# Hämtar hem Permanent Marker från Google Fonts.
#
# Fonten ligger i repot i stället för att länkas, så att appen startar på
# hemskärmen utan att vänta på ett anrop till Google och fungerar utan nät.
# Kör det här när fonten ska uppdateras, och klistra in den nya unicode-range
# och filadressen i @font-face-regeln i src/styles.css om de ändrats.
set -e

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
CSS=$(curl -sS -A "$UA" 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap')

echo "$CSS"

URL=$(echo "$CSS" | grep -o 'https://[^)]*\.woff2' | head -1)
if [ -z "$URL" ]; then
  echo "Hittade ingen woff2-adress i svaret." >&2
  exit 1
fi

curl -sS -A "$UA" "$URL" -o src/assets/fonts/permanent-marker-latin-400.woff2
echo "Hämtade $URL"
