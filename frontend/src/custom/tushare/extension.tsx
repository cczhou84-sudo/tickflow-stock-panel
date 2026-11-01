import { BarChart3 } from 'lucide-react'
import type { FrontendExtension } from '@/extensions/types'
import TusharePage from './TusharePage'

const extension: FrontendExtension = {
  id: 'tushare.panel',
  apiVersion: 1,
  routes: [
    { id: 'tushare-page', path: '/tushare', component: TusharePage },
  ],
  navigation: [
    { id: 'tushare-page', routeId: 'tushare-page', label: 'Tushare分析', icon: BarChart3, order: 6 },
  ],
}

export default extension
