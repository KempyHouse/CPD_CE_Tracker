/**
 * data-table.src.js — Full-featured TanStack Table v8 wrapper
 * Built: esbuild → dist/data-table.js (IIFE, window.DataTableLib.DataTable)
 *
 * Features: global filter, column filters, multi-sort, row selection,
 *   row expansion, row grouping, column visibility, resizing, ordering,
 *   pagination. Icons: Material Symbols Outlined throughout.
 */
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
} from '@tanstack/table-core';

// ── Material Symbols helper ───────────────────────────────────────────
const ms = (name, sz = 16) =>
  `<span class="material-symbols-outlined" style="font-size:${sz}px;line-height:1;vertical-align:middle" aria-hidden="true">${name}</span>`;

const CHECKBOX_ID = '__select__';
const EXPAND_ID   = '__expand__';

export class DataTable {
  constructor({ el, columns, data = [], options = {} }) {
    this.el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.el) throw new Error('DataTable: container element not found');

    this.opts = {
      pageSize: 10,
      pageSizes: [10, 25, 50, 100],
      searchable: true,
      searchPlaceholder: 'Search…',
      emptyText: 'No records found.',
      enableMultiSort: true,
      enableColumnFilters: false,
      enableRowSelection: false,
      enableRowExpansion: false,
      enableRowGrouping: false,
      enableColumnVisibility: true,
      enableColumnResizing: true,
      enableColumnOrdering: true,
      bulkActions: [],
      onSelectionChange: null,
      onRowClick: null,
      ...options,
    };

    this._data             = data;
    this._userCols         = columns;
    this._colDefs          = this._wrapCols(columns);
    this._globalFilter     = '';
    this._sorting          = [];
    this._pagination       = { pageIndex: 0, pageSize: this.opts.pageSize };
    this._columnPinning    = { left: [], right: [] };
    this._columnVisibility = {};
    this._columnFilters    = [];
    this._rowSelection     = {};
    this._expanded         = {};
    this._grouping         = [];
    this._columnOrder      = [];
    this._columnSizing     = {};
    this._colFiltersOpen   = this.opts.enableColumnFilters;
    this._colMenuOpen      = false;
    this._dragSrcId        = null;

    this._build();
    this._render();
  }

  // ── Inject select / expand utility columns ─────────────────────
  _wrapCols(cols) {
    const out = [];
    if (this.opts.enableRowSelection) {
      out.push({
        id: CHECKBOX_ID,
        header: '__checkbox_header__',
        cell: ctx => {
          const sel = ctx.row.getIsSelected?.() ?? false;
          return `<input type="checkbox" ${sel ? 'checked' : ''} data-select-row="${ctx.row.id}" />`;
        },
        enableSorting: false, enableResizing: false, enableGrouping: false,
        size: 36, minSize: 36, maxSize: 36,
      });
    }
    if (this.opts.enableRowExpansion) {
      out.push({
        id: EXPAND_ID,
        header: '',
        cell: ctx => {
          const open = ctx.row.getIsExpanded?.() ?? false;
          return `<button class="dt-expand-btn${open ? ' dt-expand-btn--open' : ''}" data-expand-row="${ctx.row.id}">
            ${ms(open ? 'expand_less' : 'expand_more', 16)}
          </button>`;
        },
        enableSorting: false, enableResizing: false, enableGrouping: false,
        size: 36, minSize: 36, maxSize: 36,
      });
    }
    return [...out, ...cols];
  }

  // ── Build TanStack table ────────────────────────────────────────
  _build() {
    const self = this;
    const tableOptions = {
      data: this._data,
      columns: this._colDefs,
      state: {
        sorting: this._sorting, globalFilter: this._globalFilter,
        pagination: this._pagination, columnPinning: this._columnPinning,
        columnVisibility: this._columnVisibility, columnFilters: this._columnFilters,
        rowSelection: this._rowSelection, expanded: this._expanded,
        grouping: this._grouping, columnOrder: this._columnOrder,
        columnSizing: this._columnSizing,
      },
      getCoreRowModel:       getCoreRowModel(),
      getSortedRowModel:     getSortedRowModel(),
      getFilteredRowModel:   getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      enableMultiSort:       this.opts.enableMultiSort,
      enableRowSelection:    this.opts.enableRowSelection,
      enableColumnResizing:  this.opts.enableColumnResizing,
      columnResizeMode: 'onChange',
      renderFallbackValue: '—',
      onSortingChange:          u => { self._sorting          = self._up(u, self._sorting);          self._sync(); },
      onGlobalFilterChange:     u => { self._globalFilter     = self._up(u, self._globalFilter);     self._pagination.pageIndex = 0; self._sync(); },
      onColumnFiltersChange:    u => { self._columnFilters    = self._up(u, self._columnFilters);    self._pagination.pageIndex = 0; self._sync(); },
      onPaginationChange:       u => { self._pagination       = self._up(u, self._pagination);       self._sync(); },
      onColumnVisibilityChange: u => { self._columnVisibility = self._up(u, self._columnVisibility); self._sync(); },
      onRowSelectionChange:     u => { self._rowSelection = self._up(u, self._rowSelection); self._sync(); if (self.opts.onSelectionChange) self.opts.onSelectionChange(self._getSelectedRows()); },
      onExpandedChange:         u => { self._expanded     = self._up(u, self._expanded);     self._sync(); },
      onGroupingChange:         u => { self._grouping     = self._up(u, self._grouping);     self._sync(); },
      onColumnOrderChange:      u => { self._columnOrder  = self._up(u, self._columnOrder);  self._sync(); },
      onColumnSizingChange:     u => { self._columnSizing = self._up(u, self._columnSizing); self._sync(); },
    };
    if (this.opts.enableRowGrouping)  tableOptions.getGroupedRowModel  = getGroupedRowModel();
    if (this.opts.enableRowExpansion) tableOptions.getExpandedRowModel = getExpandedRowModel();
    this._table = createTable(tableOptions);
  }

  _up(updater, prev) { return typeof updater === 'function' ? updater(prev) : updater; }

  _sync() {
    this._table.setOptions(prev => ({
      ...prev, data: this._data,
      state: {
        ...prev.state,
        sorting: this._sorting, globalFilter: this._globalFilter,
        pagination: this._pagination, columnPinning: this._columnPinning,
        columnVisibility: this._columnVisibility, columnFilters: this._columnFilters,
        rowSelection: this._rowSelection, expanded: this._expanded,
        grouping: this._grouping, columnOrder: this._columnOrder,
        columnSizing: this._columnSizing,
      },
    }));
    this._render();
  }

  // ── Full re-render ─────────────────────────────────────────────
  _render() {
    this.el.innerHTML = '';
    this.el.classList.add('dt-root');
    try {
      this.el.appendChild(this._renderToolbar());
      if (this.opts.enableRowSelection) this.el.appendChild(this._renderBulkBar());
      const wrap = document.createElement('div');
      wrap.className = 'dt-table-wrap';
      wrap.appendChild(this._renderTable());
      this.el.appendChild(wrap);
      this.el.appendChild(this._renderPagination());
      this._attachEvents();
    } catch (err) {
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'padding:20px;color:#b91c1c;font-family:monospace;font-size:12px;border:1px solid #fee2e2;border-radius:6px;background:#fff5f5;margin:10px;';
      errDiv.textContent = 'DataTable render error: ' + err.message;
      this.el.appendChild(errDiv);
      console.error('[DataTable] render error:', err);
    }
  }

  // ── Toolbar ───────────────────────────────────────────────────
  _renderToolbar() {
    const bar = document.createElement('div');
    bar.className = 'dt-toolbar';

    if (this.opts.searchable) {
      const sw = document.createElement('div');
      sw.className = 'dt-search-wrap';
      sw.innerHTML = `${ms('search', 17)}<input type="text" class="dt-search" placeholder="${this.opts.searchPlaceholder}" value="${this._globalFilter}" autocomplete="off" />`;
      bar.appendChild(sw);
    }

    if (this.opts.enableColumnFilters) {
      const btn = document.createElement('button');
      btn.className = `dt-toolbar-btn${this._colFiltersOpen ? ' dt-toolbar-btn--active' : ''}`;
      btn.dataset.action = 'toggle-col-filters';
      btn.innerHTML = `${ms('filter_list')} Filters`;
      bar.appendChild(btn);
    }

    if (this.opts.enableRowGrouping) {
      const groupable = this._table.getAllLeafColumns().filter(c =>
        c.columnDef.enableGrouping !== false && c.id !== CHECKBOX_ID && c.id !== EXPAND_ID);
      const sel = document.createElement('select');
      sel.className = 'dt-toolbar-btn';
      sel.dataset.action = 'groupby';
      sel.style.cursor = 'pointer';
      sel.innerHTML = `<option value="">— Group by —</option>` +
        groupable.map(c => `<option value="${c.id}" ${this._grouping[0] === c.id ? 'selected' : ''}>${this._headerLabel(c)}</option>`).join('');
      bar.appendChild(sel);
    }

    if (this.opts.enableColumnVisibility) {
      const wrap = document.createElement('div');
      wrap.className = 'dt-col-menu-wrap';
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'dt-toolbar-btn';
      toggleBtn.dataset.action = 'toggle-col-menu';
      toggleBtn.innerHTML = `${ms('view_column')} Columns`;
      wrap.appendChild(toggleBtn);

      const menu = document.createElement('div');
      menu.className = `dt-col-menu${this._colMenuOpen ? ' dt-col-menu--open' : ''}`;
      const title = document.createElement('div');
      title.className = 'dt-col-menu-title';
      title.textContent = 'Show / Hide Columns';
      menu.appendChild(title);
      this._table.getAllLeafColumns().forEach(col => {
        if (col.id === CHECKBOX_ID || col.id === EXPAND_ID) return;
        const item = document.createElement('label');
        item.className = 'dt-col-menu-item';
        item.innerHTML = `<input type="checkbox" ${col.getIsVisible() ? 'checked' : ''} data-toggle-col="${col.id}" />${this._headerLabel(col)}`;
        menu.appendChild(item);
      });
      wrap.appendChild(menu);
      bar.appendChild(wrap);
    }

    const count = document.createElement('span');
    count.className = 'dt-count';
    const total = this._table.getFilteredRowModel().rows.length;
    count.textContent = `${total} record${total !== 1 ? 's' : ''}`;
    bar.appendChild(count);
    return bar;
  }

  // ── Bulk action bar ──────────────────────────────────────────
  _renderBulkBar() {
    const selected = this._getSelectedRows();
    const bar = document.createElement('div');
    bar.className = `dt-bulk-bar${selected.length ? ' dt-bulk-bar--visible' : ''}`;
    const label = document.createElement('span');
    label.className = 'dt-bulk-label';
    label.textContent = `${selected.length} row${selected.length !== 1 ? 's' : ''} selected`;
    bar.appendChild(label);
    (this.opts.bulkActions || []).forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'dt-bulk-action';
      btn.textContent = action.label;
      btn.addEventListener('click', () => action.action(selected));
      bar.appendChild(btn);
    });
    const clear = document.createElement('button');
    clear.className = 'dt-bulk-clear';
    clear.title = 'Clear selection';
    clear.innerHTML = ms('close', 16);
    clear.addEventListener('click', () => { this._rowSelection = {}; this._sync(); });
    bar.appendChild(clear);
    return bar;
  }

  // ── Table ────────────────────────────────────────────────────
  _renderTable() {
    const tbl = document.createElement('table');
    tbl.className = 'dt-table';
    const thead = document.createElement('thead');

    this._table.getHeaderGroups().forEach(hg => {
      const tr = document.createElement('tr');
      hg.headers.forEach(h => {
        const th = document.createElement('th');
        const sz = h.getSize();
        if (sz) th.style.width = sz + 'px';

        if (h.column.id === CHECKBOX_ID) {
          th.className = 'dt-checkbox-col';
          const allSel  = this._allSelected();
          const someSel = this._someSelected();
          th.innerHTML = `<input type="checkbox" ${allSel ? 'checked' : ''} ${someSel && !allSel ? 'data-indeterminate="1"' : ''} data-select-all="1" />`;
          tr.appendChild(th); return;
        }
        if (h.column.id === EXPAND_ID) {
          th.className = 'dt-checkbox-col';
          tr.appendChild(th); return;
        }

        const canSort = h.column.getCanSort();
        if (canSort) {
          th.classList.add('dt-sortable');
          th.title = 'Click to sort' + (this.opts.enableMultiSort ? ' · Shift+click for multi-sort' : '');
          th.addEventListener('click', e => h.column.getToggleSortingHandler()(e));
        }
        if (this.opts.enableColumnOrdering) {
          th.draggable = true;
          th.dataset.colId = h.column.id;
        }

        const inner = document.createElement('div');
        inner.className = 'dt-th-inner';
        const labelEl = document.createElement('span');
        labelEl.innerHTML = h.isPlaceholder ? '' : this._val(h.column.columnDef.header, h.getContext());
        inner.appendChild(labelEl);

        if (canSort) {
          const dir  = h.column.getIsSorted();
          const rank = h.column.getSortIndex();
          const icon = document.createElement('span');
          icon.className = `dt-sort-icon${!dir ? ' dt-sort-icon--idle' : ''}`;
          icon.innerHTML = dir === 'asc' ? ms('arrow_upward', 14) : dir === 'desc' ? ms('arrow_downward', 14) : ms('swap_vert', 14);
          inner.appendChild(icon);
          if (dir && rank >= 0 && this.opts.enableMultiSort) {
            const badge = document.createElement('span');
            badge.className = 'dt-sort-rank';
            badge.textContent = String(rank + 1);
            inner.appendChild(badge);
          }
        }
        th.appendChild(inner);

        if (this.opts.enableColumnResizing && h.column.getCanResize()) {
          const handle = document.createElement('div');
          handle.className = 'dt-resize-handle';
          handle.addEventListener('mousedown', e => this._startResize(e, h));
          th.appendChild(handle);
        }
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    });

    // Column filter row
    if (this.opts.enableColumnFilters && this._colFiltersOpen) {
      const filterRow = document.createElement('tr');
      filterRow.className = 'dt-filter-row';
      this._table.getHeaderGroups()[0].headers.forEach(h => {
        const th = document.createElement('th');
        if (h.column.id === CHECKBOX_ID || h.column.id === EXPAND_ID) { filterRow.appendChild(th); return; }
        if (h.column.getCanFilter?.()) {
          const def = h.column.columnDef;
          const currentVal = (this._columnFilters.find(f => f.id === h.column.id)?.value) ?? '';
          if (def.filterOptions) {
            const sel = document.createElement('select');
            sel.className = 'dt-col-filter-select';
            sel.dataset.colFilterId = h.column.id;
            sel.innerHTML = `<option value="">All</option>` +
              def.filterOptions.map(o => `<option value="${o}" ${currentVal === o ? 'selected' : ''}>${o}</option>`).join('');
            th.appendChild(sel);
          } else {
            const inp = document.createElement('input');
            inp.type = 'text'; inp.className = 'dt-col-filter';
            inp.placeholder = 'Filter…'; inp.value = String(currentVal);
            inp.dataset.colFilterId = h.column.id;
            th.appendChild(inp);
          }
        }
        filterRow.appendChild(th);
      });
      thead.appendChild(filterRow);
    }
    tbl.appendChild(thead);

    // TBODY
    const tbody = document.createElement('tbody');
    const rows = this._table.getRowModel().rows;

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = this._colDefs.length;
      td.className = 'dt-empty';
      td.textContent = this.opts.emptyText;
      tr.appendChild(td); tbody.appendChild(tr);
    } else {
      rows.forEach(row => {
        if (row.getIsGrouped?.()) {
          const tr = document.createElement('tr');
          tr.className = 'dt-group-row'; tr.dataset.rowId = row.id;
          const td = document.createElement('td');
          td.colSpan = this._colDefs.length;
          const groupVal = row.getGroupingValue?.(row.groupingColumnId) ?? '';
          const expanded = row.getIsExpanded?.() ?? false;
          td.innerHTML = `<span style="margin-right:6px">${ms(expanded ? 'expand_more' : 'chevron_right', 16)}</span><strong>${groupVal}</strong> <span style="font-weight:400;opacity:.6;font-size:10.5px">(${row.subRows?.length ?? 0})</span>`;
          td.addEventListener('click', () => row.getToggleExpandedHandler()?.());
          tr.appendChild(td); tbody.appendChild(tr); return;
        }

        const tr = document.createElement('tr');
        const classes = ['dt-row'];
        if (row.getIsSelected?.()) classes.push('dt-row--selected');
        if ((row.depth ?? 0) > 0) classes.push('dt-row--child');
        tr.className = classes.join(' ');
        tr.dataset.rowId = row.id;

        row.getVisibleCells().forEach(cell => {
          const td = document.createElement('td');
          if (cell.column.id === CHECKBOX_ID || cell.column.id === EXPAND_ID) {
            td.className = 'dt-checkbox-col';
            td.innerHTML = this._val(cell.column.columnDef.cell, cell.getContext());
          } else {
            const v = this._val(cell.column.columnDef.cell, cell.getContext());
            if (typeof v === 'string') td.innerHTML = v;
            else if (v instanceof Node) td.appendChild(v);
            else td.textContent = (v ?? '—');
          }
          tr.appendChild(td);
        });

        tr.addEventListener('click', e => {
          if (e.target.closest('button,a,input,select')) return;
          this.el.dispatchEvent(new CustomEvent('dt:rowclick', { bubbles: true, detail: { row: row.original, id: row.id } }));
          if (this.opts.onRowClick) this.opts.onRowClick(row.original);
        });
        tbody.appendChild(tr);

        if (this.opts.enableRowExpansion && row.getIsExpanded?.() && this._userCols.some(c => c.expandedContent)) {
          const expRow = document.createElement('tr');
          expRow.className = 'dt-expanded-row';
          const expTd = document.createElement('td');
          expTd.colSpan = this._colDefs.length;
          const expDef = this._userCols.find(c => c.expandedContent);
          if (expDef) expTd.innerHTML = expDef.expandedContent(row.original);
          expRow.appendChild(expTd); tbody.appendChild(expRow);
        }
      });
    }
    tbl.appendChild(tbody);

    if (this._userCols.some(c => c.footer)) {
      const tfoot = document.createElement('tfoot');
      this._table.getFooterGroups().forEach(fg => {
        const tr = document.createElement('tr');
        fg.headers.forEach(h => {
          const th = document.createElement('th');
          th.innerHTML = h.isPlaceholder ? '' : this._val(h.column.columnDef.footer, h.getContext());
          tr.appendChild(th);
        });
        tfoot.appendChild(tr);
      });
      tbl.appendChild(tfoot);
    }
    return tbl;
  }

  // ── Pagination ───────────────────────────────────────────────
  _renderPagination() {
    const state     = this._table.getState().pagination;
    const pageCount = this._table.getPageCount();
    const pi        = state.pageIndex;
    const total     = this._table.getFilteredRowModel().rows.length;

    const bar = document.createElement('div');
    bar.className = 'dt-pagination';

    const sz = document.createElement('div');
    sz.className = 'dt-page-size';
    sz.innerHTML = `Show <select class="dt-size-select">${this.opts.pageSizes.map(s => `<option value="${s}"${s === state.pageSize ? ' selected' : ''}>${s}</option>`).join('')}</select> per page`;
    sz.querySelector('select').addEventListener('change', e =>
      this._table.options.onPaginationChange({ pageIndex: 0, pageSize: Number(e.target.value) }));
    bar.appendChild(sz);

    const nav = document.createElement('div');
    nav.className = 'dt-page-nav';
    const pgBtn = (iconName, action, disabled) => {
      const b = document.createElement('button');
      b.className = 'dt-page-btn';
      b.innerHTML = ms(iconName, 18);
      b.disabled = disabled;
      b.addEventListener('click', action);
      return b;
    };
    nav.appendChild(pgBtn('first_page',       () => this._table.options.onPaginationChange({ ...state, pageIndex: 0 }),             pi === 0));
    nav.appendChild(pgBtn('navigate_before',  () => this._table.options.onPaginationChange({ ...state, pageIndex: pi - 1 }),        pi === 0));
    const info = document.createElement('span');
    info.className = 'dt-page-info';
    const from = pi * state.pageSize + 1;
    const to   = Math.min(from + state.pageSize - 1, total);
    info.textContent = total === 0 ? 'No records' : `${from}–${to} of ${total}`;
    nav.appendChild(info);
    nav.appendChild(pgBtn('navigate_next',    () => this._table.options.onPaginationChange({ ...state, pageIndex: pi + 1 }),        pi >= pageCount - 1));
    nav.appendChild(pgBtn('last_page',        () => this._table.options.onPaginationChange({ ...state, pageIndex: pageCount - 1 }), pi >= pageCount - 1));
    bar.appendChild(nav);
    return bar;
  }

  // ── Event delegation ─────────────────────────────────────────
  _attachEvents() {
    const searchEl = this.el.querySelector('.dt-search');
    if (searchEl) searchEl.addEventListener('input', e => this._table.options.onGlobalFilterChange(e.target.value));

    this.el.querySelectorAll('[data-col-filter-id]').forEach(inp => {
      const handler = e => {
        const id  = inp.dataset.colFilterId;
        const val = e.target.value;
        const next = this._columnFilters.filter(f => f.id !== id);
        if (val) next.push({ id, value: val });
        this._table.options.onColumnFiltersChange(next);
      };
      inp.tagName === 'SELECT' ? inp.addEventListener('change', handler) : inp.addEventListener('input', handler);
    });

    this.el.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle-col-filters') { this._colFiltersOpen = !this._colFiltersOpen; this._render(); }
      if (btn.dataset.action === 'toggle-col-menu')    { this._colMenuOpen    = !this._colMenuOpen;    this._render(); }
    });

    const groupSel = this.el.querySelector('[data-action="groupby"]');
    if (groupSel) {
      groupSel.addEventListener('change', e => {
        const val = e.target.value;
        this._table.options.onGroupingChange(val ? [val] : []);
        this._expanded = {};
        this._sync();
      });
    }

    this.el.querySelectorAll('[data-toggle-col]').forEach(inp => {
      inp.addEventListener('change', () => {
        const col = this._table.getColumn(inp.dataset.toggleCol);
        if (col) this._table.options.onColumnVisibilityChange({ ...this._columnVisibility, [col.id]: inp.checked });
      });
    });

    this.el.querySelectorAll('[data-select-all]').forEach(chk => {
      if (chk.dataset.indeterminate) chk.indeterminate = true;
      chk.addEventListener('change', () => this._toggleAllRows(chk.checked));
    });

    this.el.addEventListener('change', e => {
      if (!e.target.dataset.selectRow) return;
      const rowId = e.target.dataset.selectRow;
      const row   = this._table.getRow(rowId);
      if (row) {
        const next = { ...this._rowSelection };
        if (e.target.checked) next[rowId] = true; else delete next[rowId];
        this._table.options.onRowSelectionChange(next);
      }
    });

    this.el.addEventListener('click', e => {
      const btn = e.target.closest('[data-expand-row]');
      if (!btn) return;
      e.stopPropagation();
      const row = this._table.getRow(btn.dataset.expandRow);
      if (!row) return;
      const next = { ...this._expanded };
      if (row.getIsExpanded?.()) delete next[row.id]; else next[row.id] = true;
      this._table.options.onExpandedChange(next);
    });

    if (this.opts.enableColumnOrdering) {
      this.el.querySelectorAll('th[data-col-id]').forEach(th => {
        th.addEventListener('dragstart', e => { this._dragSrcId = th.dataset.colId; th.classList.add('dt-th--dragging'); e.dataTransfer.effectAllowed = 'move'; });
        th.addEventListener('dragend',   ()  => { th.classList.remove('dt-th--dragging'); this._dragSrcId = null; });
        th.addEventListener('dragover',  e  => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; th.classList.add('dt-th--dragover'); });
        th.addEventListener('dragleave', ()  => th.classList.remove('dt-th--dragover'));
        th.addEventListener('drop', e => {
          e.preventDefault(); th.classList.remove('dt-th--dragover');
          const targetId = th.dataset.colId;
          if (!this._dragSrcId || this._dragSrcId === targetId) return;
          this._reorderColumn(this._dragSrcId, targetId);
        });
      });
    }
  }

  _reorderColumn(srcId, targetId) {
    let order = this._table.getAllLeafColumns().map(c => c.id);
    const si = order.indexOf(srcId), ti = order.indexOf(targetId);
    if (si < 0 || ti < 0) return;
    order.splice(si, 1); order.splice(ti, 0, srcId);
    this._table.options.onColumnOrderChange(order);
  }

  _startResize(e, header) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startSize = header.getSize();
    const handle = e.currentTarget;
    handle.classList.add('dt-resize-handle--resizing');
    const onMove = mv => {
      const delta = mv.clientX - startX;
      const minSize = header.column.columnDef.minSize ?? 60;
      const newSize = Math.max(minSize, startSize + delta);
      this._columnSizing = { ...this._columnSizing, [header.column.id]: newSize };
      this._table.setOptions(prev => ({ ...prev, state: { ...prev.state, columnSizing: this._columnSizing } }));
      const allHeaders = this._table.getFlatHeaders();
      this.el.querySelectorAll('thead th').forEach((th, i) => { if (allHeaders[i]) th.style.width = allHeaders[i].getSize() + 'px'; });
    };
    const onUp = () => { handle.classList.remove('dt-resize-handle--resizing'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); this._sync(); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Helpers ───────────────────────────────────────────────────
  _val(def, ctx) { return typeof def === 'function' ? def(ctx) : (def ?? ''); }
  _headerLabel(col) {
    const h = col.columnDef.header;
    if (typeof h === 'string') return h;
    if (typeof h === 'function') { try { return h({ column: col, table: this._table, header: null }) ?? col.id; } catch { return col.id; } }
    return col.id;
  }
  _allSelected()  { const rows = this._table.getRowModel().rows; return rows.length > 0 && rows.every(r => this._rowSelection[r.id]); }
  _someSelected() { return Object.keys(this._rowSelection).length > 0; }
  _toggleAllRows(checked) {
    const next = {};
    if (checked) this._table.getRowModel().rows.forEach(r => { next[r.id] = true; });
    this._table.options.onRowSelectionChange(next);
  }
  _getSelectedRows() {
    const selIds = new Set(Object.keys(this._rowSelection));
    return this._table.getRowModel().rows.filter(r => selIds.has(r.id)).map(r => r.original);
  }

  // ── Public API ────────────────────────────────────────────────
  setData(data) { this._data = data; this._pagination.pageIndex = 0; this._rowSelection = {}; this._sync(); }
  setFilter(value) { this._table.options.onGlobalFilterChange(value); }
  getSelectedRows() { return this._getSelectedRows(); }
  clearSelection() { this._rowSelection = {}; this._sync(); }
  destroy() { this.el.innerHTML = ''; this.el.classList.remove('dt-root'); }
}
