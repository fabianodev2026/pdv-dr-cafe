import { useState, useMemo } from 'react'
import './PendingPayments.css'

interface PendingPayment {
  id: number
  customerName: string
  productName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  purchaseDate: string
  dueDate: string
  status: string
}

interface NewPending {
  customerName: string
  productName: string
  quantity: number
  unitPrice: number
  purchaseDate: string
  dueDate: string
}

export default function PendingPayments() {
  const [pendingList, setPendingList] = useState<PendingPayment[]>([
    {
      id: 1,
      customerName: 'João Silva',
      productName: 'Café Expresso + Pão de Queijo',
      quantity: 1,
      unitPrice: 12.5,
      totalAmount: 25.0,
      purchaseDate: '2026-04-14',
      dueDate: '2026-04-20',
      status: 'Pendente',
    },
  ])

  const [newPending, setNewPending] = useState<NewPending>({
    customerName: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    purchaseDate: '',
    dueDate: '',
  })

  const calculatedTotal = useMemo(() => {
    return newPending.quantity * newPending.unitPrice
  }, [newPending.quantity, newPending.unitPrice])

  const handleAddPending = () => {
    setPendingList([
      ...pendingList,
      {
        id: Date.now(),
        ...newPending,
        totalAmount: calculatedTotal,
        status: 'Pendente',
      },
    ])
    setNewPending({
      customerName: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      purchaseDate: '',
      dueDate: '',
    })
  }

  return (
    <div className="pending-payments">
      <header className="header">
        <h1 className="title">Contas a Receber (Vai Pagar)</h1>
      </header>

      <section className="add-form">
        <h2>Nova Conta</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Nome do Cliente</label>
            <input
              type="text"
              value={newPending.customerName}
              onChange={(e) =>
                setNewPending({ ...newPending, customerName: e.target.value })
              }
              placeholder="Ex: Maria"
            />
          </div>
          <div className="form-group">
            <label>Produto(s)</label>
            <input
              type="text"
              value={newPending.productName}
              onChange={(e) =>
                setNewPending({ ...newPending, productName: e.target.value })
              }
              placeholder="Ex: Cappuccino"
            />
          </div>
          <div className="form-group">
            <label>Data da Compra</label>
            <input
              type="date"
              value={newPending.purchaseDate}
              onChange={(e) =>
                setNewPending({ ...newPending, purchaseDate: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Data que vai pagar</label>
            <input
              type="date"
              value={newPending.dueDate}
              onChange={(e) =>
                setNewPending({ ...newPending, dueDate: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label>Quantidade</label>
            <input
              type="number"
              value={newPending.quantity}
              onChange={(e) =>
                setNewPending({
                  ...newPending,
                  quantity: parseInt(e.target.value) || 1,
                })
              }
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Valor Unitário (R$)</label>
            <input
              type="number"
              value={newPending.unitPrice}
              onChange={(e) =>
                setNewPending({
                  ...newPending,
                  unitPrice: parseFloat(e.target.value) || 0,
                })
              }
              step="0.01"
            />
          </div>
          <div className="form-group total-display">
            <label>Valor Total</label>
            <div className="calculated-value">R$ {calculatedTotal.toFixed(2)}</div>
          </div>
        </div>
        <button onClick={handleAddPending} className="btn-primary">
          Registrar Conta
        </button>
      </section>

      <section className="list-section">
        <h2>Contas Pendentes</h2>
        <div className="pending-grid">
          {pendingList.map((pending) => (
            <div key={pending.id} className="pending-card">
              <div className="card-header">
                <h3>{pending.customerName}</h3>
                <span className={`status ${pending.status.toLowerCase()}`}>
                  {pending.status}
                </span>
              </div>
              <p>
                <strong>Produto:</strong> {pending.productName}
              </p>
              <p>
                <strong>Quantidade:</strong> {pending.quantity}x
              </p>
              <p>
                <strong>Valor Unitário:</strong> R$ {pending.unitPrice.toFixed(2)}
              </p>
              <p>
                <strong>Total:</strong> <span className="amount">R$ {pending.totalAmount.toFixed(2)}</span>
              </p>
              <p className="dates">
                <strong>Compra:</strong> {pending.purchaseDate} <br />
                <strong>Vencimento:</strong> {pending.dueDate}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
