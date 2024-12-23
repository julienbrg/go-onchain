import { ThemingProps } from '@chakra-ui/react'
export const SITE_DESCRIPTION = 'On-chain Go'
export const SITE_NAME = 'Go'
export const SITE_URL = 'https://play-go.netlify.app'

export const THEME_INITIAL_COLOR = 'system'
export const THEME_COLOR_SCHEME: ThemingProps['colorScheme'] = 'blue'
export const THEME_CONFIG = {
  initialColorMode: THEME_INITIAL_COLOR,
}

export const SOCIAL_TWITTER = 'julienbrg'
export const SOCIAL_GITHUB = 'julienbrg/game-of-go-ui'

export const SERVER_SESSION_SETTINGS = {
  cookieName: SITE_NAME,
  password: process.env.SESSION_PASSWORD ?? 'UPDATE_TO_complex_password_at_least_32_characters_long',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
}
