<template>
  <div id="app-container">
    <nav class="navbar">
      <div class="logo-area">
        <span class="logo-text">☕ Dr. Café PDV</span>
      </div>
      <div class="menu-links">
        <RouterLink to="/products" class="nav-link">Produtos</RouterLink>
        <RouterLink to="/tables" class="nav-link">Mesas</RouterLink>
        <RouterLink to="/pending" class="nav-link">Vai Pagar</RouterLink>
        <RouterLink to="/finance" class="nav-link">Financeiro</RouterLink>
        <RouterLink to="/settings" class="nav-link">⚙️ Configurações</RouterLink>
      </div>
    </nav>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* Estilos globais e da Barra de Navegação */
body {
  margin: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #fafafa; /* Bege claro */
}

.navbar {
  background-color: #3e2723; /* Marrom escuro do logo */
  color: white;
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.logo-text {
  font-size: 1.5em;
  font-weight: bold;
  font-style: italic; /* Trazendo a elegância do seu logo */
}

.menu-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  color: #d7ccc8; /* Bege acinzentado */
  text-decoration: none;
  font-weight: bold;
  padding: 8px 12px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.nav-link:hover,
.router-link-active {
  background-color: #5d4037; /* Marrom médio */
  color: white;
}

.content {
  padding: 20px;
}
</style>
