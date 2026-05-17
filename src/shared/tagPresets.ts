export interface TagPresetGroup {
  group: string
  color: string
  tags: string[]
}

export const MUSIC_TAG_PRESETS: TagPresetGroup[] = [
  {
    group: '情绪',
    color: '#ec4899',
    tags: [
      'Uplifting', 'Epic', 'Powerful', 'Exciting', 'Happy', 'Funny',
      'Carefree', 'Hopeful', 'Love', 'Playful', 'Groovy', 'Sexy',
      'Peaceful', 'Mysterious', 'Serious', 'Dramatic', 'Angry', 'Tense',
      'Sad', 'Scary', 'Dark',
    ],
  },
  {
    group: '主题',
    color: '#0ea5e9',
    tags: [
      'Business', 'Technology', 'Time Lapse', 'Food', 'Education',
      'Documentary', 'Weddings', 'Vlog', 'Gaming', 'Road Trip', 'Travel',
      'Sport & Fitness', 'Lifestyle', 'Building & City', 'Nightlife',
      'Fashion', 'Science', 'Medical', 'Industry', 'Aerials', 'Landscape',
      'Nature', 'Slow Motion',
    ],
  },
  {
    group: '类型',
    color: '#a78bfa',
    tags: [
      'Acoustic', 'Ambient', 'Blues', 'Children', 'Cinematic', 'Classical',
      'Corporate', 'Country', 'Electronic', 'Fantasy', 'Folk', 'Funk',
      'Hip Hop', 'Holiday', 'Indie', 'Jazz', 'Latin', 'Lounge', 'Pop',
      'Reggae', 'Retro', 'Rock', 'Singer-Songwriter', 'Soul & RnB',
      'World', 'Worship',
    ],
  },
  {
    group: '乐器',
    color: '#f59e0b',
    tags: [
      'Acoustic Drums', 'Acoustic Guitar', 'Backing Vocals', 'Bells',
      'Brass', 'Claps & Snaps', 'Electric Guitar', 'Electronic Drums',
      'Ethnic', '键盘乐', 'Mandolin & Ukulele', 'Orchestra',
      'Other Wind Instruments', 'Pads', 'Percussion', 'Piano', 'Strings',
      'Synth', 'Vocal', 'Whistle', 'Woodwinds',
    ],
  },
]
