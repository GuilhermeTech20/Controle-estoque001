    const DB = {
        read(chave) {
          return JSON.parse(localStorage.getItem(chave) || "[]")
        },
        write(chave, dados) {
          localStorage.setItem(chave, JSON.stringify(dados))
        },
      }

      function novoId() {
        return Date.now() + Math.floor(Math.random() * 1000)
      }

      function carregarDados() {
        let categorias = DB.read("categorias")
        if (categorias.length === 0) {
          categorias = [{ id: novoId(), nome: "Geral" }]
          DB.write("categorias", categorias)
        }
        return {
          categorias,
          produtos: DB.read("produtos"),
          movimentacoes: DB.read("movimentacoes"),
        }
      }

      let categorias = []
      let produtos = []
      let movimentacoes = []

      function recarregar() {
        const dados = carregarDados()
        categorias = dados.categorias
        produtos = dados.produtos
        movimentacoes = dados.movimentacoes
      }

      function formatarReal(valor) {
        return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      }

      function formatarData(iso) {
        const d = new Date(iso)
        return (
          d.toLocaleDateString("pt-BR") +
          " " +
          d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        )
      }

      function nomeCategoria(id) {
        const c = categorias.find((c) => c.id === id)
        return c ? c.nome : "-"
      }

      function statusProduto(p) {
        if (p.quantidade <= 0) return { label: "Sem estoque", classe: "badge-zero" }
        if (p.quantidade <= p.estoqueMinimo) return { label: "Estoque baixo", classe: "badge-low" }
        return { label: "Normal", classe: "badge-ok" }
      }

      let toastTimer
      function toast(mensagem, tipo = "ok") {
        const el = document.getElementById("toast")
        if (!el) return
        el.textContent = mensagem
        el.className = "toast " + (tipo === "error" ? "error" : "")
        el.classList.remove("hidden")
        clearTimeout(toastTimer)
        toastTimer = setTimeout(() => el.classList.add("hidden"), 2800)
      }

      let telaAtual = "painel"
      let transicionando = false

      function trocarTela(view) {
        const viewId = view === "movimentações" ? "view-movimentacoes" : "view-" + view
        const alvo = document.getElementById(viewId)
        if (!alvo) return

        document
          .querySelectorAll(".nav-btn")
          .forEach((b) => b.classList.toggle("active", b.dataset.view === view))

        if (view === telaAtual || transicionando) return
        transicionando = true

        const atualId = telaAtual === "movimentações" ? "view-movimentacoes" : "view-" + telaAtual
        const anterior = document.getElementById(atualId)

        const mostrarNova = () => {
          renderizarTudo()
          alvo.classList.remove("hidden", "view-leave")
          void alvo.offsetWidth
          alvo.classList.add("view-enter")
          alvo.addEventListener(
            "animationend",
            () => {
              alvo.classList.remove("view-enter")
              transicionando = false
            },
            { once: true }
          )
          telaAtual = view
        }

        if (anterior && anterior !== alvo && !anterior.classList.contains("hidden")) {
          anterior.classList.remove("view-enter")
          anterior.classList.add("view-leave")
          anterior.addEventListener(
            "animationend",
            () => {
              anterior.classList.add("hidden")
              anterior.classList.remove("view-leave")
              mostrarNova()
            },
            { once: true }
          )
        } else {
          document.querySelectorAll(".view").forEach((s) => {
            if (s !== alvo) s.classList.add("hidden")
          })
          mostrarNova()
        }
      }

      document.getElementById("nav").addEventListener("click", (e) => {
        const btn = e.target.closest(".nav-btn")
        if (btn) trocarTela(btn.dataset.view)
      })

      function renderizarPainel() {
        const totalProdutos = produtos.length
        const totalItens = produtos.reduce((s, p) => s + p.quantidade, 0)
        const valorEstoque = produtos.reduce((s, p) => s + p.quantidade * p.precoVenda, 0)
        const baixos = produtos.filter((p) => p.quantidade <= p.estoqueMinimo)
        const elProdutos = document.getElementById("stat-produtos")
        const elItens = document.getElementById("stat-itens")
        const elValor = document.getElementById("stat-valor")
        const elAlertas = document.getElementById("stat-alertas")

        if (elProdutos) elProdutos.textContent = totalProdutos
        if (elItens) elItens.textContent = totalItens
        if (elValor) elValor.textContent = formatarReal(valorEstoque)
        if (elAlertas) elAlertas.textContent = baixos.length

        const alertasEl = document.getElementById("lista-alertas")
        if (alertasEl) {
          if (baixos.length === 0) {
            alertasEl.innerHTML =
              '<p class="empty">Nenhum produto com estoque baixo. Está tudo certo!</p>'
          } else {
            alertasEl.innerHTML = baixos
              .map(
                (p) => `
                <div class="list-item">
                  <div>
                    <div class="li-nome">${p.nome}</div>
                    <div class="li-info">Mínimo: ${p.estoqueMinimo}</div>
                  </div>
                  <span class="badge ${statusProduto(p).classe}">${p.quantidade} un.</span>
                </div>`,
              )
              .join("")
          }
        }

        const contagem = {}
        movimentacoes.forEach((m) => {
          contagem[m.produtoId] = (contagem[m.produtoId] || 0) + m.quantidade
        })

        const ranking = Object.entries(contagem)
          .map(([produtoId, total]) => {
            const p = produtos.find((p) => p.id === Number(produtoId))
            return p ? { nome: p.nome, total } : null
          })
          .filter(Boolean)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)

        const rankingEl = document.getElementById("lista-rankig")
        if (rankingEl) {
          if (ranking.length === 0) {
            rankingEl.innerHTML = '<p class="empty">Nenhuma movimentação registrada.</p>'
          } else {
            rankingEl.innerHTML = ranking
              .map(
                (r) => `
                <div class="list-item">
                  <span class="li-nome">${r.nome}</span>
                  <span class="li-info">${r.total} un.</span>
                </div>`,
              )
              .join("")
          }
        }
      }

      function renderizarCategorias() {
        const tbody = document.getElementById("tabela-categorias")
        const vazio = document.getElementById("categorias-vazio")

        if (tbody) {
          tbody.innerHTML = categorias
            .map((c) => {
              const qtd = produtos.filter((p) => p.categoriaId === c.id).length
              return `
              <tr>
                <td>${c.nome}</td>
                <td class="num">${qtd}</td>
                <td class="acoes-col">
                  <div class="row-actions">
                    <button class="btn-link danger" data-acao="excluir-categoria" data-id="${c.id}">Excluir</button>
                  </div>
                </td>
              </tr>`
            })
            .join("")
        }
        if (vazio) vazio.classList.toggle("hidden", categorias.length > 0)
      }

      document.getElementById("form-categorias").addEventListener("submit", (e) => {
        e.preventDefault()
        const input = document.getElementById("input-categoria")
        const nome = input.value.trim()
        if (!nome) return
        categorias.push({ id: novoId(), nome })
        DB.write("categorias", categorias)
        input.value = ""
        toast("Categoria adicionada!")
        renderizarTudo()
      })

      function excluirCategoria(id) {
        const temProduto = produtos.some((p) => p.categoriaId === id)
        if (temProduto) {
          toast("Não é possível excluir: há produtos nesta categoria.", "error")
          return
        }
        if (!confirm("Excluir esta categoria?")) return
        categorias = categorias.filter((c) => c.id !== id)
        DB.write("categorias", categorias)
        toast("Categoria excluída.")
        renderizarTudo()
      }

      /* ==================== PRODUTOS ==================== */
      function renderizarProdutos() {
        const tbody = document.getElementById("tabela-produtos")
        const vazio = document.getElementById("produtos-vazio")

        if (tbody) {
          tbody.innerHTML = produtos
            .map((p) => {
              const st = statusProduto(p)
              return `
              <tr>
                <td>${p.nome}</td>
                <td>${nomeCategoria(p.categoriaId)}</td>
                <td class="num">${formatarReal(p.precoVenda)}</td>
                <td class="num">${p.quantidade}</td>
                <td><span class="badge ${st.classe}">${st.label}</span></td>
                <td class="acoes-col">
                  <div class="row-actions">
                    <button class="btn-link" data-acao="editar-produto" data-id="${p.id}">Editar</button>
                    <button class="btn-link danger" data-acao="excluir-produto" data-id="${p.id}">Excluir</button>
                  </div>
                </td>
              </tr>`
            })
            .join("")
        }
        if (vazio) vazio.classList.toggle("hidden", produtos.length > 0)
      }

      function preencherSelectCategorias() {
        const sel = document.getElementById("produto-categoria")
        if (sel) sel.innerHTML = categorias.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("")
      }

      const modal = document.getElementById("modal-produto")

      function abrirModalProduto(produto = null) {
        preencherSelectCategorias()
        const titulo = document.getElementById("modal-produto-titulo")

        if (produto) {
          titulo.textContent = "Editar produto"
          document.getElementById("produto-id").value = produto.id
          document.getElementById("produto-nome").value = produto.nome
          document.getElementById("produto-categoria").value = produto.categoriaId
          document.getElementById("produto-preco-compra").value = produto.precoCompra
          document.getElementById("produto-preco-venda").value = produto.precoVenda
          document.getElementById("produto-quantidade").value = produto.quantidade
          document.getElementById("produto-quantidade").disabled = true
          document.getElementById("produto-minimo").value = produto.estoqueMinimo
        } else {
          titulo.textContent = "Novo produto"
          document.getElementById("form-produto").reset()
          document.getElementById("produto-id").value = ""
          document.getElementById("produto-quantidade").disabled = false
        }
        if (modal) modal.classList.remove("hidden")
      }

      function fecharModalProduto() {
        if (modal) modal.classList.add("hidden")
      }

      document.getElementById("btn-novo-produto").addEventListener("click", () => {
        if (categorias.length === 0) {
          toast("Crie uma categoria primeiro.", "error")
          return
        }
        abrirModalProduto()
      })

      document.getElementById("btn-cancelar-produto").addEventListener("click", fecharModalProduto)

      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) fecharModalProduto()
        })
      }

      document.getElementById("form-produto").addEventListener("submit", (e) => {
        e.preventDefault()
        const id = document.getElementById("produto-id").value
        const dados = {
          nome: document.getElementById("produto-nome").value.trim(),
          categoriaId: Number(document.getElementById("produto-categoria").value),
          precoCompra: Number(document.getElementById("produto-preco-compra").value) || 0,
          precoVenda: Number(document.getElementById("produto-preco-venda").value) || 0,
          quantidade: Number(document.getElementById("produto-quantidade").value) || 0,
          estoqueMinimo: Number(document.getElementById("produto-minimo").value) || 0,
        }

        if (!dados.nome) {
          toast("Informe o nome do produto.", "error")
          return
        }

        if (id) {
          const idx = produtos.findIndex((p) => p.id === Number(id))
          if (idx !== -1) {
            dados.quantidade = produtos[idx].quantidade
            produtos[idx] = { ...produtos[idx], ...dados }
            toast("Produto atualizado!")
          }
        } else {
          produtos.push({ id: novoId(), ...dados, criadoEm: new Date().toISOString() })
          toast("Produto cadastrado!")
        }
        DB.write("produtos", produtos)
        fecharModalProduto()
        renderizarTudo()
      })

      function editarProduto(id) {
        const p = produtos.find((p) => p.id === id)
        if (p) abrirModalProduto(p)
      }

      function excluirProduto(id) {
        if (!confirm("Excluir este produto? As movimentações dele também serão removidas.")) return
        produtos = produtos.filter((p) => p.id !== id)
        movimentacoes = movimentacoes.filter((m) => m.produtoId !== id)
        DB.write("produtos", produtos)
        DB.write("movimentacoes", movimentacoes)
        toast("Produto excluído.")
        renderizarTudo()
      }

      function preencherSelectProdutosMov() {
        const sel = document.getElementById("mov-produto")
        if (!sel) return
        if (produtos.length === 0) {
          sel.innerHTML = '<option value="">Cadastre um produto primeiro</option>'
        } else {
          sel.innerHTML = produtos
            .map((p) => `<option value="${p.id}">${p.nome} (estoque: ${p.quantidade})</option>`)
            .join("")
        }
      }

      function renderizarMovimentacoes() {
        preencherSelectProdutosMov()
        const tbody = document.getElementById("tabela-movimentacoes")
        const vazio = document.getElementById("movimentacoes-vazio")

        const ordenadas = [...movimentacoes].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))

        if (tbody) {
          tbody.innerHTML = ordenadas
            .map((m) => {
              const p = produtos.find((p) => p.id === m.produtoId)
              const badge = m.tipo === "entrada" ? "badge-entrada" : "badge-saida"
              const sinal = m.tipo === "entrada" ? "+" : "-"
              return `
              <tr>
                <td>${formatarData(m.criadoEm)}</td>
                <td>${p ? p.nome : "(removido)"}</td>
                <td><span class="badge ${badge}">${m.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
                <td class="num">${sinal}${m.quantidade}</td>
                <td>${m.observacao || "-"}</td>
              </tr>`
            })
            .join("")
        }
        if (vazio) vazio.classList.toggle("hidden", movimentacoes.length > 0)
      }

      document.getElementById("form-movimentacao").addEventListener("submit", (e) => {
        e.preventDefault()
        const produtoId = Number(document.getElementById("mov-produto").value)
        const tipo = document.getElementById("mov-tipo").value
        const quantidade = Number(document.getElementById("mov-qtd").value)
        const observacao = document.getElementById("mov-obs").value.trim()

        const produto = produtos.find((p) => p.id === produtoId)
        if (!produto) {
          toast("Selecione um produto válido.", "error")
          return
        }
        if (quantidade <= 0) {
          toast("A quantidade deve ser maior que zero.", "error")
          return
        }
        if (tipo === "saida" && quantidade > produto.quantidade) {
          toast(`Estoque insuficiente. Disponível: ${produto.quantidade}.`, "error")
          return
        }

        produto.quantidade += tipo === "entrada" ? quantidade : -quantidade

        movimentacoes.push({
          id: novoId(),
          produtoId,
          tipo,
          quantidade,
          observacao,
          criadoEm: new Date().toISOString(),
        })
        DB.write("produtos", produtos)
        DB.write("movimentacoes", movimentacoes)
        document.getElementById("mov-qtd").value = 1
        document.getElementById("mov-obs").value = ""
        toast(tipo === "entrada" ? "Entrada registrada!" : "Saída registrada!")
        renderizarTudo()
      })

      document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-acao]")
        if (!btn) return
        const id = Number(btn.dataset.id)
        switch (btn.dataset.acao) {
          case "editar-produto":
            editarProduto(id)
            break
          case "excluir-produto":
            excluirProduto(id)
            break
          case "excluir-categoria":
            excluirCategoria(id)
            break
        }
      })

      function renderizarTudo() {
        recarregar()
        renderizarPainel()
        renderizarProdutos()
        renderizarCategorias()
        renderizarMovimentacoes()
      }

      recarregar()
      renderizarTudo()

      const telaInicial = document.getElementById("view-painel")
      if (telaInicial) {
        telaInicial.classList.add("view-enter")
        telaInicial.addEventListener(
          "animationend",
          () => telaInicial.classList.remove("view-enter"),
          { once: true }
        )
      }

      const dock = document.querySelector(".nav")
      const buttons = Array.from(document.querySelectorAll(".nav-btn"))

      const MAX_SCALE = 1.6      
      const RANGE = 130         
      const LIFT = 14           

      let pointerX = null
      let rafId = null

      function applyMagnify() {
        rafId = null
        buttons.forEach((btn) => {
          if (pointerX === null) {
            btn.style.transform = "translateY(0) scale(1)"
            btn.classList.remove("is-hovered")
            return
          }
          const rect = btn.getBoundingClientRect()
          const center = rect.left + rect.width / 2
          const distance = Math.abs(pointerX - center)

          let t = 0
          if (distance < RANGE) {
            t = (Math.cos((distance / RANGE) * Math.PI) + 1) / 2
          }
          const scale = 1 + (MAX_SCALE - 1) * t
          const lift = LIFT * t
          btn.style.transform = `translateY(${-lift}px) scale(${scale})`
          btn.classList.toggle("is-hovered", t > 0.6)
        })
      }

      function requestMagnify() {
        if (rafId === null) rafId = requestAnimationFrame(applyMagnify)
      }

      dock.addEventListener("mousemove", (e) => {
        pointerX = e.clientX
        requestMagnify()
      })

      dock.addEventListener("mouseleave", () => {
        pointerX = null
        buttons.forEach((btn) => {
          btn.style.transition =
            "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease, color 0.25s ease"
          btn.style.transform = "translateY(0) scale(1)"
          btn.classList.remove("is-hovered")
        })

        setTimeout(() => {
          buttons.forEach((btn) => (btn.style.transition = ""))
        }, 350)
      })
      
      dock.addEventListener("touchstart", (e) => {
        const btn = e.target.closest(".nav-btn")
        if (btn) btn.style.transform = "translateY(-6px) scale(1.15)"
      })
      dock.addEventListener("touchend", () => {
        buttons.forEach((btn) => (btn.style.transform = ""))
      })