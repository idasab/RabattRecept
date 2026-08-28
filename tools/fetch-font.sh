#!/bin/sh
# Hämtar hem appens typsnitt från Google Fonts.
#
# Fonterna ligger i repot i stället för att länkas, så att appen startar på
# hemskärmen utan att vänta på ett anrop till Google och fungerar utan nät.
# Bara den latinska delmängden hämtas: appen är på svenska, och de kyrilliska,
# grekiska och vietnamesiska snitten skulle femdubbla vikten utan att ritas.
#
# Kör det här när fonterna ska uppdateras. Ändras unicode-range i svaret
# behöver den klistras in i @font-face-reglerna i src/styles.css.
set -e

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

# Plockar ut woff2-adressen för latin ur Googles CSS-svar.
latin_url() {
  awk '/\/\* latin \*\//{ found = 1 } found && /woff2/ { print; exit }' \
    | grep -o 'https://[^)]*\.woff2'
}

fetch() {
  query="$1"
  target="$2"

  css=$(curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=$query&display=swap")
  url=$(printf '%s\n' "$css" | latin_url)

  if [ -z "$url" ]; then
    echo "Hittade ingen latinsk woff2 för $query." >&2
    exit 1
  fi

  curl -sS -A "$UA" "$url" -o "$target"
  echo "$target <- $url"
  printf '%s\n' "$css" | awk '/\/\* latin \*\//{ found = 1 } found && /unicode-range/ { print; exit }'
}

fetch 'Permanent+Marker' src/assets/fonts/permanent-marker-latin-400.woff2
fetch 'Commissioner:wght@400..700' src/assets/fonts/commissioner-latin-400-700.woff2
