import React, { Component, Fragment } from 'react'

import { connect } from 'redaction'
import actions from 'redux/actions'

import cssModules from 'react-css-modules'
import styles from './Wallet.scss'
import { isMobile } from 'react-device-detect'
import moment from 'moment'
import firestore from 'helpers/firebase/firestore'

import History from 'pages/History/History'

import { links, constants } from 'helpers'
import { localisedUrl } from 'helpers/locale'
import { getActivatedCurrencies } from 'helpers/user'

import { injectIntl } from 'react-intl'

import config from 'helpers/externalConfig'
import { withRouter } from 'react-router'
import CurrenciesList from './CurrenciesList'
import InvoicesList from 'pages/Invoices/InvoicesList'

import DashboardLayout from 'components/layout/DashboardLayout/DashboardLayout'
import BalanceForm from 'components/BalanceForm/BalanceForm'


const isWidgetBuild = config && config.isWidget

@connect(
  ({
    core: { hiddenCoinsList },
    user,
    user: {
      activeFiat,
      ethData,
      btcData,
      btcMultisigSMSData,
      btcMultisigUserData,
      btcMultisigUserDataList,
      tokensData,
      isFetching,
      isBalanceFetching,
    },
    currencies: { items: currencies },
    createWallet: { currencies: assets },
    modals,
    ui: { dashboardModalsAllowed },
  }) => {
    let widgetMultiTokens = []
    if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
      Object.keys(window.widgetERC20Tokens).forEach((key) => {
        widgetMultiTokens.push(key.toUpperCase())
      })
    }
    const tokens =
      config && config.isWidget
        ? window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length
          ? widgetMultiTokens
          : [config.erc20token.toUpperCase()]
        : Object.keys(tokensData).map((k) => tokensData[k].currency)

    const tokensItems = Object.keys(tokensData).map((k) => tokensData[k])

    const allData = [
      btcData,
      btcMultisigSMSData,
      btcMultisigUserData,
      ethData,
      ...Object.keys(tokensData).map((k) => tokensData[k]),
    ].map(({ account, keyPair, ...data }) => ({
      ...data,
    }))

    const items = (config && config.isWidget
      ? [btcData, ethData]
      : [btcData, btcMultisigSMSData, btcMultisigUserData, ethData]
    ).map((data) => data.currency)

    return {
      tokens,
      items,
      allData,
      tokensItems,
      currencies,
      assets,
      isFetching,
      isBalanceFetching,
      hiddenCoinsList: hiddenCoinsList,
      userEthAddress: ethData.address,
      user,
      activeFiat,
      tokensData: {
        ethData,
        btcData,
        btcMultisigSMSData,
        btcMultisigUserData,
        btcMultisigUserDataList,
      },
      dashboardView: dashboardModalsAllowed,
      modals,
    }
  }
)
@injectIntl
@withRouter
@connect(({ signUp: { isSigned } }) => ({
  isSigned,
}))
@cssModules(styles, { allowMultiple: true })
export default class Wallet extends Component {
  constructor(props) {
    super(props)

    const {
      match: {
        params: { page = null },
      },
    } = props

    let activeView = 0

    if (page === 'history' && !isMobile) {
      activeView = 1
    }
    if (page === 'invoices') activeView = 2

    this.state = {
      activeView,
      btcBalance: 0,
      enabledCurrencies: getActivatedCurrencies(),
    }
  }

  componentDidUpdate(prevProps) {
    const {
      activeFiat,
      match: {
        params: { page = null },
      },
    } = this.props
    const {
      activeFiat: prevFiat,
      match: {
        params: { page: prevPage = null },
      },
    } = prevProps

    if (activeFiat !== prevFiat) {
      this.getFiats()
    }

    if (page !== prevPage) {
      let activeView = 0

      if (page === 'history' && !isMobile) {
        activeView = 1
      }
      if (page === 'invoices') activeView = 2
      this.setState({
        activeView,
      })
    }
  }

  componentDidMount() {
    const { params, url } = this.props.match

    actions.user.getBalances()
    this.getFiats()

    if (url.includes('withdraw')) {
      this.handleWithdraw(params)
    }
    this.getInfoAboutCurrency()
  }

  getInfoAboutCurrency = async () => {
    const { currencies } = this.props
    const currencyNames = currencies.map(({ name }) => name)

    await actions.user.getInfoAboutCurrency(currencyNames)
  }

  handleWithdraw = params => {
    const { allData } = this.props
    const { address, amount } = params
    const item = allData.find(({ currency }) => currency.toLowerCase() === params.currency.toLowerCase())

    actions.modals.open(constants.modals.Withdraw, {
      ...item,
      toAddress: address,
      amount,
    })
  }

  goToСreateWallet = () => {
    const {
      history,
      intl: { locale },
    } = this.props

    history.push(localisedUrl(locale, links.createWallet))
  }

  handleGoExchange = () => {
    const {
      history,
      intl: { locale },
    } = this.props

    if (isWidgetBuild && !config.isFullBuild) {
      history.push(localisedUrl(locale, links.pointOfSell))
    } else {
      history.push(localisedUrl(locale, links.exchange))
    }
  }

  handleModalOpen = context => {
    const { enabledCurrencies } = this.state
    const { hiddenCoinsList } = this.props

    /* @ToDo Вынести отдельно */
    // Набор валют для виджета
    const widgetCurrencies = ['BTC']
    if (!hiddenCoinsList.includes('BTC (SMS-Protected)')) widgetCurrencies.push('BTC (SMS-Protected)')
    if (!hiddenCoinsList.includes('BTC (Multisig)')) widgetCurrencies.push('BTC (Multisig)')
    widgetCurrencies.push('ETH')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach((key) => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    const currencies = actions.core.getWallets().filter(({ currency, balance }) => {
      return (
        (context === 'Send' ? balance : true) &&
        !hiddenCoinsList.includes(currency) &&
        enabledCurrencies.includes(currency) &&
        (isWidgetBuild ? widgetCurrencies.includes(currency) : true)
      )
    })

    actions.modals.open(constants.modals.CurrencyAction, {
      currencies,
      context,
    })
  }

  checkBalance = () => {
    // that is for noxon, dont delete it :)
    const now = moment().format('HH:mm:ss DD/MM/YYYY')
    const lastCheck = localStorage.getItem(constants.localStorage.lastCheckBalance) || now
    const lastCheckMoment = moment(lastCheck, 'HH:mm:ss DD/MM/YYYY')

    const isFirstCheck = moment(now, 'HH:mm:ss DD/MM/YYYY').isSame(lastCheckMoment)
    const isOneHourAfter = moment(now, 'HH:mm:ss DD/MM/YYYY').isAfter(lastCheckMoment.add(1, 'hours'))

    const { ethData, btcData } = this.props.tokensData

    const balancesData = {
      ethBalance: ethData.balance,
      btcBalance: btcData.balance,
      ethAddress: ethData.address,
      btcAddress: btcData.address,
    }

    if (isOneHourAfter || isFirstCheck) {
      localStorage.setItem(constants.localStorage.lastCheckBalance, now)
      firestore.updateUserData(balancesData)
    }
  }


  getFiats = async () => {
    const { activeFiat } = this.props
    const { fiatsRates } = await actions.user.getFiats()

    if (fiatsRates) {
      const fiatRate = fiatsRates.find(({ key }) => key === activeFiat)
      this.setState(() => ({ multiplier: fiatRate.value }))
    }
  }

  render() {
    const {
      multiplier,
      activeView,
      infoAboutCurrency,
      enabledCurrencies,
    } = this.state
    const {
      hiddenCoinsList,
      isBalanceFetching,
      activeFiat,
      match: {
      params: {
        page = null,
      },
    }, } = this.props

    const allData = actions.core.getWallets()

    this.checkBalance()

    let btcBalance = 0
    let fiatBalance = 0
    let changePercent = 0

    // Набор валют для виджета
    const widgetCurrencies = ['BTC']
    if (!hiddenCoinsList.includes('BTC (SMS-Protected)')) widgetCurrencies.push('BTC (SMS-Protected)')
    if (!hiddenCoinsList.includes('BTC (Multisig)')) widgetCurrencies.push('BTC (Multisig)')
    widgetCurrencies.push('ETH')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach((key) => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    let tableRows = allData.filter(({ currency, address, balance }) => {
      // @ToDo - В будущем нужно убрать проверку только по типу монеты.
      // Старую проверку оставил, чтобы у старых пользователей не вывалились скрытые кошельки

      return (!hiddenCoinsList.includes(currency) && !hiddenCoinsList.includes(`${currency}:${address}`)) || balance > 0
    })

    if (isWidgetBuild) {
      //tableRows = allData.filter(({ currency }) => widgetCurrencies.includes(currency))
      tableRows = allData.filter(
        ({ currency, address }) =>
          !hiddenCoinsList.includes(currency) && !hiddenCoinsList.includes(`${currency}:${address}`)
      )
      // Отфильтруем валюты, исключив те, которые не используются в этом билде
      tableRows = tableRows.filter(({ currency }) => widgetCurrencies.includes(currency))
    }

    tableRows = tableRows.filter(({ currency }) => enabledCurrencies.includes(currency))

    tableRows.forEach(({ name, infoAboutCurrency, balance, currency }) => {
      const currName = currency || name

      if ((!isWidgetBuild || widgetCurrencies.includes(currName)) && infoAboutCurrency && balance !== 0) {
        if (currName === 'BTC') {
          changePercent = infoAboutCurrency.percent_change_1h
        }
        btcBalance += balance * infoAboutCurrency.price_btc
        fiatBalance += balance * infoAboutCurrency.price_usd * (multiplier || 1)
      }
    })

    return (
      <DashboardLayout
        page={page}
        BalanceForm={(
          <BalanceForm
            activeFiat={activeFiat}
            fiatBalance={fiatBalance}
            currencyBalance={btcBalance}
            changePercent={changePercent}
            handleReceive={this.handleModalOpen}
            handleWithdraw={this.handleModalOpen}
            handleExchange={this.handleGoExchange}
            isFetching={isBalanceFetching}
            currency="btc"
            infoAboutCurrency={infoAboutCurrency}
          />
        )}
      >
        {
          activeView === 0 && 
            <CurrenciesList
              tableRows={tableRows}
              {...this.state}
              {...this.props}
              goToСreateWallet={this.goToСreateWallet}
              getExCurrencyRate={(currencySymbol, rate) => this.getExCurrencyRate(currencySymbol, rate)}
            />
        }
        {activeView === 1 && (<History {...this.props} />)}
        {activeView === 2 && (<InvoicesList {...this.props} onlyTable={true} />)}
      </DashboardLayout>
    )
  }
}
