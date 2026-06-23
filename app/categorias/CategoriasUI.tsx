"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/ui/Modal";
import { Button, Input, Select } from "@/app/ui/primitives";
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  type Categoria,
  type TipoCategoria,
} from "./actions";

const ROTULO: Record<TipoCategoria, { sing: string; plur: string }> = {
  produto: { sing: "categoria de produto", plur: "Categorias de produtos" },
  cliente: { sing: "categoria de cliente", plur: "Categorias de clientes" },
};

// Select de categoria com botão para gerenciar (criar/editar/excluir) sem sair da tela.
export function CategoriaSelect({
  tipo,
  categorias,
  value,
  onChange,
  onCategoriasChange,
}: {
  tipo: TipoCategoria;
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
  onCategoriasChange: (lista: Categoria[]) => void;
}) {
  const [gerenciar, setGerenciar] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <Select
          className="flex-1"
          placeholder="Sem categoria"
          opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variante="secondary" onClick={() => setGerenciar(true)}>
          Gerenciar
        </Button>
      </div>
      {gerenciar && (
        <GerenciarCategoriasModal
          tipo={tipo}
          onFechar={() => setGerenciar(false)}
          onMudou={(lista) => {
            onCategoriasChange(lista);
            // Se a categoria selecionada foi excluída, limpa a seleção.
            if (value && !lista.some((c) => c.id === value)) onChange("");
          }}
        />
      )}
    </>
  );
}

// Modal de gerenciamento de categorias (CRUD completo) — usado nas páginas de
// produtos e clientes e dentro do CategoriaSelect.
export function GerenciarCategoriasModal({
  tipo,
  onFechar,
  onMudou,
}: {
  tipo: TipoCategoria;
  onFechar: () => void;
  onMudou: (lista: Categoria[]) => void;
}) {
  const [lista, setLista] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    const l = await listarCategorias(tipo);
    setLista(l);
    setCarregando(false);
    onMudou(l);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  async function adicionar() {
    if (!nova.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarCategoria(tipo, nova);
      setNova("");
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(id: string) {
    setSalvando(true);
    setErro(null);
    try {
      await atualizarCategoria(id, editNome);
      setEditId(null);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    setSalvando(true);
    setErro(null);
    try {
      await excluirCategoria(id);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={ROTULO[tipo].plur}
      largura="max-w-lg"
      rodape={<Button variante="secondary" onClick={onFechar}>Fechar</Button>}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Nova ${ROTULO[tipo].sing}…`}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          />
          <Button type="button" onClick={adicionar} disabled={salvando || !nova.trim()}>
            Adicionar
          </Button>
        </div>

        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}

        {carregando ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Nenhuma categoria ainda. Crie a primeira acima.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {lista.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                {editId === c.id ? (
                  <>
                    <Input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvarEdicao(c.id); } }}
                    />
                    <Button type="button" onClick={() => salvarEdicao(c.id)} disabled={salvando}>Salvar</Button>
                    <Button type="button" variante="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{c.nome}</span>
                    <Button
                      type="button"
                      variante="secondary"
                      onClick={() => { setEditId(c.id); setEditNome(c.nome); }}
                    >
                      Renomear
                    </Button>
                    <Button
                      type="button"
                      variante="dangerSoft"
                      onClick={() => remover(c.id)}
                      disabled={salvando}
                    >
                      Excluir
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[var(--muted)]">
          Excluir uma categoria não apaga os {tipo === "produto" ? "produtos" : "clientes"} — eles apenas ficam sem categoria.
        </p>
      </div>
    </Modal>
  );
}
