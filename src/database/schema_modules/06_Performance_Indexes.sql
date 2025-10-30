/* * Module: Performance Indexes (Optional, but included for completeness) */

-- Inventory
CREATE INDEX IF NOT EXISTS idx_soh_part_bin_status ON inventory_stock_on_hand (part_id, bin_id, stock_status_id);
CREATE INDEX IF NOT EXISTS idx_soh_lot_number ON inventory_stock_on_hand (lot_number);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_txn_history_type ON inventory_transaction_history (transaction_type);
CREATE INDEX IF NOT EXISTS idx_txn_history_source ON inventory_transaction_history (source_document_type, source_document_id);

-- QC
CREATE INDEX IF NOT EXISTS idx_qc_lots_part_id ON qc_lots (part_id);
CREATE INDEX IF NOT EXISTS idx_qc_results_lot_id ON qc_inspection_results (qc_lot_id);