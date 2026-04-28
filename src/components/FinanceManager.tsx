import { useState, useMemo } from 'react'
import './FinanceManager.css'

interface Transaction {
  id: number
  date: string
  description: string
  type: 'receita' | 'despesa'
  amount: number
}

export default function FinanceManager() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      date: '2026-04-10',
      description: 'Vendas do dia',
      type: 'receita',
      amount: 450.5,
    },
    {
      id: 2,
      date: '2026-04-11',
      description: 'Vendas do dia',
      type: 'receita',
      amount: 520.0,
    },
    {
      id: 3,
      date: '2026-04-12',
      description: 'Fornecedor de Grãos',
      type: 'despesa',
      amount: 200.0,
    },
    {
      id: 4,
      date: '2026-04-13',
      description: 'Conta de Luz',
      type: 'despesa',
      amount: 150.0,
    },
    {
      id: 5,
      date: '2026-04-14',
      description: 'Vendas do dia',
      type: 'receita',
      amount: 610.25,
    },
  ])

  const totals = useMemo(() => {
    const totalReceitas = transactions
      .filter((t) => t.type === 'receita')
      .reduce((acc, curr) => acc + curr.amount, 0)

    const totalDespesas = transactions
      .filter((t) => t.type === 'despesa')
      .reduce((acc, curr) => acc + curr.amount, 0)

    const saldoAtual = totalReceitas - totalDespesas

    return { totalReceitas, totalDespesas, saldoAtual }
  }, [transactions])

  return (
    <div className="finance-manager">
      <header className="header">
        <h1 className="title">Balanço Financeiro</h1>
      </header>

      <section className="summary-cards">
        <div className="card income">
          <h3>Receitas (Mês)</h3>
          <p className="amount">R$ {totals.totalReceitas.toFixed(2)}</p>
        </div>
        <div className="card expense">
          <h3>Despesas (Mês)</h3>
          <p className="amount">R$ {totals.totalDespesas.toFixed(2)}</p>
        </div>
        <div
          className={`card balance ${
            totals.saldoAtual >= 0 ? 'positive' : 'negative'
          }`}
        >
          <h3>Saldo Líquido</h3>
          <p className="amount">R$ {totals.saldoAtual.toFixed(2)}</p>
        </div>
      </section>

      <section className="transaction-list">
        <h2>Histórico de Transações</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>{item.date}</td>
                <td>{item.description}</td>
                <td>
                  <span
                    className={`badge ${item.type}`}
                  >
                    {item.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className={`amount-cell ${item.type}`}>
                  {item.type === 'receita' ? '+' : '-'} R${' '}
                  {item.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
