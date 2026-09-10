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

export const INITIAL_PLAYLIST: Track[] = [
  {
    id: 'sakamoto-andata',
    title: 'andata (Ambient Piano)',
    artist: '坂本龍一 · 意境重奏',
    album: '《async》 / 经典钢琴心流',
    duration: 208, // 3分28秒 完整全曲
    genre: 'Ambient / Piano',
    themeColor: '#7C8C6E',
    coverUrl: '/covers/sakamoto.jpg',
    audioUrl: '/audio/andata-ambient.mp3',
    isFull: true,
  },
  {
    id: 'hisaishi-summer',
    title: 'Summer (菊次郎的夏天)',
    artist: '久石让 · 钢琴重奏',
    album: '北野武电影原声经典',
    duration: 185, // 3分05秒 完整全曲
    genre: 'Soundtrack / Piano',
    themeColor: '#9AAFB2',
    coverUrl: '/covers/summer.jpg',
    audioUrl: '/audio/summer-piano.mp3',
    isFull: true,
  },
  {
    id: 'westlake-rain',
    title: '西湖秋雨 · 琴声入水',
    artist: '自然声景 · 现场拾音',
    album: '《初秋漫步》 / 专注冥想',
    duration: 198, // 3分18秒 完整全曲
    genre: 'Rain & Lo-Fi',
    themeColor: '#C4A882',
    coverUrl: '/covers/rain.jpg',
    audioUrl: '/audio/westlake-rain.mp3',
    isFull: true,
  },
  {
    id: 'charlotte-piano',
    title: 'Charlotte (静夜之忆)',
    artist: '纯音物语 · 钢琴独奏',
    album: '《宁静夜色》 / 原声经典',
    duration: 182, // 3分02秒 完整全曲
    genre: 'Acoustic / Piano',
    themeColor: '#6B7F5E',
    coverUrl: '/covers/charlotte.jpg',
    audioUrl: '/audio/charlotte.mp3',
    isFull: true,
  },
  {
    id: 'joyful-donuts',
    title: 'Joyful Donuts (初秋微风)',
    artist: 'Lofi Cafe · 温暖律动',
    album: '《案头咖啡》 / 晨间心流',
    duration: 154, // 2分34秒 完整全曲
    genre: 'Lo-Fi / Beats',
    themeColor: '#8B9D83',
    coverUrl: '/covers/donuts.jpg',
    audioUrl: '/audio/joyful-donuts.mp3',
    isFull: true,
  },
]
