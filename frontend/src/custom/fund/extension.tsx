import { Wallet } from 'lucide-react'
import type { FrontendExtension } from '@/extensions/types'
import FundPage from './FundPage'

const extension: FrontendExtension = {
  id: 'fund.panel',
  apiVersion: 1,
  routes: [
    { id: 'fund-page', path: '/fund', component: FundPage },
  ],
  navigation: [
    { id: 'fund-page', routeId: 'fund-page', label: '基金管理', icon: Wallet, order: 5 },
  ],
}

export default extension
