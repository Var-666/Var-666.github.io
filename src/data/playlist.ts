export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number // 秒
  genre: string
  themeColor: string
  coverUrl: string
  audioUrl: string
  isFull: boolean
}

// 站长专属精选曲库（同步自网易云「不可以叫我憨憨」精选歌单，核心曲目直通本地无损高保真流）
export const INITIAL_PLAYLIST: Track[] = [
  {
    "id": "netease-27946612",
    "title": "带我走",
    "artist": "苏打绿",
    "album": "热门华语199",
    "duration": 312,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/cpoUinrExafBHL5Nv5iDHQ==/109951166361218466.jpg?param=300y300",
    "audioUrl": "/audio/dai-wo-zou.mp3",
    "isFull": true
  },
  {
    "id": "netease-26082345",
    "title": "带我走",
    "artist": "杨丞琳",
    "album": "半熟宣言",
    "duration": 290,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/xgqaL3g1WV3r-y7SDGuDZA==/109951170708260156.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=26082345.mp3",
    "isFull": true
  },
  {
    "id": "netease-306662",
    "title": "失落沙洲",
    "artist": "徐佳莹",
    "album": "LaLa首张创作专辑",
    "duration": 299,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/b1hZLgWA9ihXkivZeqo81g==/109951168296446353.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=306662.mp3",
    "isFull": true
  },
  {
    "id": "netease-1929280593",
    "title": "Numb Little Bug (Piano Version)",
    "artist": "Em Beihold",
    "album": "Numb Little Bug (Piano Version)",
    "duration": 165,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/7qGXyPVOwtlkza3Spv1xMg==/109951167164448625.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1929280593.mp3",
    "isFull": true
  },
  {
    "id": "netease-28575553",
    "title": "Counting Stars",
    "artist": "OneRepublic",
    "album": "NRJ Hit List 2014",
    "duration": 256,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/tAzWfNK5KALyV7OO2Vc3SA==/6068204674100518.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=28575553.mp3",
    "isFull": true
  },
  {
    "id": "netease-1809108646",
    "title": "Love Story (1989 Mix)",
    "artist": "Taylor Swift",
    "album": "热门精选",
    "duration": 240,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/6C8M0t0GfjOmmas8_iVpXQ==/109951165604085144.jpg?param=300y300",
    "audioUrl": "/audio/love-story.mp3",
    "isFull": true
  },
  {
    "id": "netease-2166151146",
    "title": "We Don't Talk Anymore (feat. Selena Gomez)",
    "artist": "Charlie Puth / Selena Gomez",
    "album": "Nine Track Mind (Special Edition)",
    "duration": 217,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/AwXjw_qzI2m4siyO8_m7Ag==/109951169682634390.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=2166151146.mp3",
    "isFull": true
  },
  {
    "id": "netease-1952737857",
    "title": "Payphone",
    "artist": "Maroon 5",
    "album": "Kids Songs: Summer Camp!",
    "duration": 222,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/Yrk8cISlkr1Nf3YwEAuKRQ==/109951171791431725.jpg?param=300y300",
    "audioUrl": "/audio/payphone.mp3",
    "isFull": true
  },
  {
    "id": "netease-2043909561",
    "title": "Who Says",
    "artist": "Selena Gomez & The Scene",
    "album": "Mother’s Day Flavours",
    "duration": 195,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/LB41k49TaUYeGCYULXA01g==/109951168583027942.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=2043909561.mp3",
    "isFull": true
  },
  {
    "id": "netease-26569168",
    "title": "Stronger",
    "artist": "Kelly Clarkson",
    "album": "Kids Top 20 - De Grootste Hits Van 2013 - Summer Edition 2013",
    "duration": 221,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/NyN6he8m4t4F_yjOR_Tlww==/2495891395114271.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=26569168.mp3",
    "isFull": true
  },
  {
    "id": "netease-2127165394",
    "title": "如果声音不记得（伤感1.1×完整版）",
    "artist": "Aloneina",
    "album": "如果声音不记得（伤感1.1×完整版）",
    "duration": 258,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/eNiVuwipMbDEgyfWTbuU9w==/109951169343258043.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=2127165394.mp3",
    "isFull": true
  },
  {
    "id": "netease-1457681678",
    "title": "Mystery of Love",
    "artist": "Luke Pickman",
    "album": "Mystery of Love",
    "duration": 213,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/EzA0RJ4sni0PSfHplB_LLQ==/109951165084783424.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1457681678.mp3",
    "isFull": true
  },
  {
    "id": "netease-1862710424",
    "title": "Stay",
    "artist": "The Kid LAROI / Justin Bieber",
    "album": "F*CK LOVE 3: OVER YOU",
    "duration": 141,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/qpKo50Kz2YRYn2oUBHWX9w==/109951166196887769.jpg?param=300y300",
    "audioUrl": "/audio/stay.mp3",
    "isFull": true
  },
  {
    "id": "netease-426291544",
    "title": "Send It (feat. Rich Homie Quan)",
    "artist": "Austin Mahone / Rich Homie Quan",
    "album": "Send It (feat. Rich Homie Quan)",
    "duration": 181,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/4ZgCt77ZOVJXegIdVtSo-Q==/109951166442911780.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=426291544.mp3",
    "isFull": true
  },
  {
    "id": "netease-1946100292",
    "title": "Peter Pan Was Right",
    "artist": "Anson Seabra",
    "album": "Trending Viral Hits 2022",
    "duration": 192,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/COAGaskzm3e7xinAOzYrLQ==/109951168234018919.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1946100292.mp3",
    "isFull": true
  },
  {
    "id": "netease-32507352",
    "title": "One Last Time",
    "artist": "Ariana Grande / Fedez",
    "album": "One Last Time",
    "duration": 198,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/7RYr1lQXGKcLO9j1CI3tLA==/7981354906126192.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=32507352.mp3",
    "isFull": true
  },
  {
    "id": "netease-1843636386",
    "title": "If I Ain't Got You (Acoustic)",
    "artist": "John Adams",
    "album": "If I Ain't Got You (Acoustic)",
    "duration": 176,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/mKR0-xP74UeKp1sKAzYZgQ==/109951165964670302.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1843636386.mp3",
    "isFull": true
  },
  {
    "id": "netease-1432159268",
    "title": "paris in the rain",
    "artist": "Vision",
    "album": "Paris in the rain",
    "duration": 204,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/6fjOogsb9YjTBYbAGUWC6Q==/109951164817797370.jpg?param=300y300",
    "audioUrl": "/audio/paris-in-the-rain.mp3",
    "isFull": true
  },
  {
    "id": "netease-35724589",
    "title": "Lemon Tree",
    "artist": "Fool's Garden",
    "album": "High Times - Best Of",
    "duration": 187,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/tB8tOeoAX-xSd0T82qMMGw==/3265549604984979.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=35724589.mp3",
    "isFull": true
  },
  {
    "id": "netease-1936975624",
    "title": "Free Loop",
    "artist": "Jake＆Eddy",
    "album": "Free Loop",
    "duration": 241,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/z5ds67NEHe4irYdXy8r2zA==/109951167275181511.jpg?param=300y300",
    "audioUrl": "/audio/free-loop.mp3",
    "isFull": true
  },
  {
    "id": "netease-2080326",
    "title": "Nothing's Gonna Change My Love For You",
    "artist": "Westlife",
    "album": "The Rose",
    "duration": 229,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/mU-cKIp8HvqVUSA0gzY2Dg==/903798558076025.jpg?param=300y300",
    "audioUrl": "/audio/nothing-gonna-change.mp3",
    "isFull": true
  },
  {
    "id": "netease-1859108854",
    "title": "Not Like You (feat. Mason Murphy)",
    "artist": "Adam Turley / Mason Murphy",
    "album": "Not Like You (feat. Mason Murphy)",
    "duration": 138,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p3.music.126.net/hAafIhtUE_ive9zujb75cA==/109951169436648710.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1859108854.mp3",
    "isFull": true
  },
  {
    "id": "netease-1472480890",
    "title": "群青",
    "artist": "YOASOBI",
    "album": "群青",
    "duration": 248,
    "genre": "Cloud Music",
    "themeColor": "#7C8C6E",
    "coverUrl": "https://p4.music.126.net/sF9I_mKMVNtsCD-ZXzfV_A==/109951165251958014.jpg?param=300y300",
    "audioUrl": "https://music.163.com/song/media/outer/url?id=1472480890.mp3",
    "isFull": true
  },
  {
    "id": "hisaishi-summer",
    "title": "Summer (菊次郎的夏天)",
    "artist": "久石让 · 钢琴重奏",
    "album": "北野武电影原声经典",
    "duration": 185,
    "genre": "Soundtrack / Piano",
    "themeColor": "#9AAFB2",
    "coverUrl": "/covers/summer.jpg",
    "audioUrl": "/audio/summer-piano.mp3",
    "isFull": true
  },
  {
    "id": "sakamoto-andata",
    "title": "andata (Ambient Piano)",
    "artist": "坂本龍一 · 意境重奏",
    "album": "《async》 / 经典钢琴心流",
    "duration": 208,
    "genre": "Ambient / Piano",
    "themeColor": "#7C8C6E",
    "coverUrl": "/covers/sakamoto.jpg",
    "audioUrl": "/audio/andata-ambient.mp3",
    "isFull": true
  }
]
