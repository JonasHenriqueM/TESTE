-- =====================================================
-- INDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS IDX_RESERVA_CLIENTE
ON RESERVA (ID_CLIENTE);

CREATE INDEX IF NOT EXISTS IDX_RESERVA_DATA
ON RESERVA (DataReserva);

CREATE INDEX IF NOT EXISTS IDX_ITEMRESERVA_EQUIPAMENTO
ON ITEMRESERVA (ID_EQUIPAMENTO);


-- =====================================================
-- VIEW (Atualizada com LEFT JOIN e Cálculo de Totais)
-- =====================================================

CREATE OR REPLACE VIEW VW_RESERVAS_CLIENTES AS
SELECT
    C.ID_CLIENTE,
    C.Nome AS NomeCliente,
    C.Email,
    R.ID_RESERVA,
    R.DataReserva,
    R.HoraInicio,
    R.HoraFim,
    R.StatusReserva,
    E.NomeEspaco,
    COALESCE(E.Endereco, R.EnderecoEvento, C.Endereco) AS EnderecoAtendimento,
    CASE 
        WHEN R.ID_ESPACO IS NOT NULL THEN 'MONTAGEM'
        ELSE 'ENTREGA EM EVENTO PRÓPRIO'
    END AS ModalidadeAtendimento,
    COALESCE(E.ValorEspaco, 0.00) AS ValorEspaco,
    COALESCE(SUM(IR.QuantidadeAlugada * IR.ValorUnitario), 0.00) AS ValorEquipamentos,
    (COALESCE(E.ValorEspaco, 0.00) + COALESCE(SUM(IR.QuantidadeAlugada * IR.ValorUnitario), 0.00)) AS ValorTotal,
    STRING_AGG(EQ.NomeEquipamento || ' (' || IR.QuantidadeAlugada || 'x)', ', ') AS EquipamentosLocados
FROM CLIENTE C
INNER JOIN RESERVA R
    ON C.ID_CLIENTE = R.ID_CLIENTE
LEFT JOIN ESPACO E
    ON R.ID_ESPACO = E.ID_ESPACO
LEFT JOIN ITEMRESERVA IR
    ON R.ID_RESERVA = IR.ID_RESERVA
LEFT JOIN EQUIPAMENTO EQ
    ON IR.ID_EQUIPAMENTO = EQ.ID_EQUIPAMENTO
GROUP BY 
    C.ID_CLIENTE, C.Nome, C.Email, C.Endereco,
    R.ID_RESERVA, R.DataReserva, R.HoraInicio, R.HoraFim, R.StatusReserva, R.ID_ESPACO, R.EnderecoEvento,
    E.NomeEspaco, E.Endereco, E.ValorEspaco;


-- =====================================================
-- TRIGGERS E FUNCOES
-- =====================================================

-- 1. VALIDAR DATA DA RESERVA (>= CURRENT_DATE)
CREATE OR REPLACE FUNCTION verificar_data_reserva()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.DataReserva < CURRENT_DATE THEN
        RAISE EXCEPTION 'A data da reserva nao pode ser anterior a data atual.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VERIFICAR_DATA_RESERVA
BEFORE INSERT OR UPDATE ON RESERVA
FOR EACH ROW
EXECUTE FUNCTION verificar_data_reserva();


-- 2. VALIDAR DATAS DA FATURA (< DataReserva)
CREATE OR REPLACE FUNCTION verificar_datas_fatura()
RETURNS TRIGGER AS $$
DECLARE
    v_data_reserva DATE;
BEGIN
    SELECT R.DataReserva
    INTO v_data_reserva
    FROM RESERVA R
    WHERE R.ID_RESERVA = NEW.ID_RESERVA;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A reserva informada nao existe.';
    END IF;

    IF NEW.DataVencimento >= v_data_reserva THEN
        RAISE EXCEPTION 'A data de vencimento da fatura deve ser anterior a data da reserva.';
    END IF;

    IF NEW.DataPagamento IS NOT NULL AND NEW.DataPagamento >= v_data_reserva THEN
        RAISE EXCEPTION 'A data de pagamento deve ser anterior a data da reserva.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VERIFICAR_DATAS_FATURA
BEFORE INSERT OR UPDATE ON FATURA
FOR EACH ROW
EXECUTE FUNCTION verificar_datas_fatura();


-- 3. VALIDAR ALTERACAO DA DATA DA RESERVA (Faturas + Estoque de Equipamentos na nova data)
CREATE OR REPLACE FUNCTION verificar_alteracao_data_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_total_outros INTEGER;
BEGIN
    -- Valida datas da fatura
    IF EXISTS (
        SELECT 1
        FROM FATURA F
        WHERE F.ID_RESERVA = NEW.ID_RESERVA
          AND (
              F.DataVencimento >= NEW.DataReserva
              OR (F.DataPagamento IS NOT NULL AND F.DataPagamento >= NEW.DataReserva)
          )
    ) THEN
        RAISE EXCEPTION 'A nova data da reserva deve ser posterior as datas de vencimento e pagamento da fatura.';
    END IF;

    -- Valida se ha estoque disponivel dos equipamentos ja vinculados para a nova data
    FOR v_item IN
        SELECT IR.ID_EQUIPAMENTO, IR.QuantidadeAlugada, EQ.Quantidade AS EstoqueTotal, EQ.NomeEquipamento
        FROM ITEMRESERVA IR
        JOIN EQUIPAMENTO EQ ON IR.ID_EQUIPAMENTO = EQ.ID_EQUIPAMENTO
        WHERE IR.ID_RESERVA = NEW.ID_RESERVA
    LOOP
        SELECT COALESCE(SUM(IR2.QuantidadeAlugada), 0)
        INTO v_total_outros
        FROM ITEMRESERVA IR2
        JOIN RESERVA R2 ON IR2.ID_RESERVA = R2.ID_RESERVA
        WHERE IR2.ID_EQUIPAMENTO = v_item.ID_EQUIPAMENTO
          AND R2.DataReserva = NEW.DataReserva
          AND R2.ID_RESERVA <> NEW.ID_RESERVA
          AND R2.StatusReserva <> 'CANCELADA';

        IF (v_total_outros + v_item.QuantidadeAlugada) > v_item.EstoqueTotal THEN
            RAISE EXCEPTION 'Estoque insuficiente de % na nova data (%). Disponivel: %, Solicitado: %.',
                v_item.NomeEquipamento, NEW.DataReserva, (v_item.EstoqueTotal - v_total_outros), v_item.QuantidadeAlugada;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VALIDAR_ALTERACAO_RESERVA
BEFORE UPDATE OF DataReserva ON RESERVA
FOR EACH ROW
WHEN (OLD.DataReserva IS DISTINCT FROM NEW.DataReserva)
EXECUTE FUNCTION verificar_alteracao_data_reserva();


-- 4. CONFIRMAR RESERVA AUTOMATICAMENTE AO PAGAR FATURA
CREATE OR REPLACE FUNCTION confirmar_reserva()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR OLD.DataPagamento IS DISTINCT FROM NEW.DataPagamento THEN
        UPDATE RESERVA
        SET StatusReserva = 'CONFIRMADA'
        WHERE ID_RESERVA = NEW.ID_RESERVA;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER TRG_CONFIRMAR_RESERVA
AFTER INSERT OR UPDATE OF DataPagamento ON FATURA
FOR EACH ROW
WHEN (NEW.DataPagamento IS NOT NULL)
EXECUTE FUNCTION confirmar_reserva();


-- 5. NOVA TRIGGER: VALIDAR ESTOQUE DIARIO DO EQUIPAMENTO NA RESERVA
CREATE OR REPLACE FUNCTION verificar_estoque_equipamento_dia()
RETURNS TRIGGER AS $$
DECLARE
    v_data_reserva DATE;
    v_status_reserva VARCHAR(30);
    v_estoque_total INTEGER;
    v_nome_equipamento VARCHAR(100);
    v_qtd_ja_reservada INTEGER;
BEGIN
    -- Busca a data e o status da reserva atual
    SELECT DataReserva, StatusReserva
    INTO v_data_reserva, v_status_reserva
    FROM RESERVA
    WHERE ID_RESERVA = NEW.ID_RESERVA;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A reserva informada nao existe.';
    END IF;

    -- Se a reserva atual estiver cancelada, nao consome estoque
    IF v_status_reserva = 'CANCELADA' THEN
        RETURN NEW;
    END IF;

    -- Busca o estoque total cadastrado do equipamento
    SELECT Quantidade, NomeEquipamento
    INTO v_estoque_total, v_nome_equipamento
    FROM EQUIPAMENTO
    WHERE ID_EQUIPAMENTO = NEW.ID_EQUIPAMENTO;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'O equipamento informado nao existe.';
    END IF;

    -- Soma todas as unidades ja alugadas desse equipamento na mesma data (excluindo reservas canceladas e o proprio registro em caso de UPDATE)
    SELECT COALESCE(SUM(IR.QuantidadeAlugada), 0)
    INTO v_qtd_ja_reservada
    FROM ITEMRESERVA IR
    INNER JOIN RESERVA R ON IR.ID_RESERVA = R.ID_RESERVA
    WHERE IR.ID_EQUIPAMENTO = NEW.ID_EQUIPAMENTO
      AND R.DataReserva = v_data_reserva
      AND R.StatusReserva <> 'CANCELADA'
      AND NOT (IR.ID_RESERVA = NEW.ID_RESERVA AND IR.ID_EQUIPAMENTO = NEW.ID_EQUIPAMENTO);

    IF (v_qtd_ja_reservada + NEW.QuantidadeAlugada) > v_estoque_total THEN
        RAISE EXCEPTION 'Quantidade indisponivel para "%" no dia %. Estoque total: %, Ja reservado: %, Disponivel: %.',
            v_nome_equipamento,
            v_data_reserva,
            v_estoque_total,
            v_qtd_ja_reservada,
            GREATEST(v_estoque_total - v_qtd_ja_reservada, 0);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VERIFICAR_ESTOQUE_EQUIPAMENTO
BEFORE INSERT OR UPDATE ON ITEMRESERVA
FOR EACH ROW
EXECUTE FUNCTION verificar_estoque_equipamento_dia();


-- 6. NOVA TRIGGER: CLASSIFICAR TIPO E ENDERECO DA ENTREGA AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION definir_tipo_endereco_entrega()
RETURNS TRIGGER AS $$
DECLARE
    v_id_espaco INTEGER;
    v_endereco_espaco TEXT;
    v_endereco_evento TEXT;
    v_endereco_cliente TEXT;
BEGIN
    SELECT 
        R.ID_ESPACO,
        E.Endereco,
        R.EnderecoEvento,
        C.Endereco
    INTO 
        v_id_espaco,
        v_endereco_espaco,
        v_endereco_evento,
        v_endereco_cliente
    FROM RESERVA R
    INNER JOIN CLIENTE C ON R.ID_CLIENTE = C.ID_CLIENTE
    LEFT JOIN ESPACO E ON R.ID_ESPACO = E.ID_ESPACO
    WHERE R.ID_RESERVA = NEW.ID_RESERVA;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'A reserva informada para entrega nao existe.';
    END IF;

    IF v_id_espaco IS NOT NULL THEN
        NEW.TipoEntrega := 'MONTAGEM';
        NEW.EnderecoEntrega := COALESCE(NEW.EnderecoEntrega, v_endereco_espaco);
    ELSE
        NEW.TipoEntrega := 'ENTREGA EM EVENTO PRÓPRIO';
        NEW.EnderecoEntrega := COALESCE(NEW.EnderecoEntrega, v_endereco_evento, v_endereco_cliente);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_DEFINIR_TIPO_ENDERECO_ENTREGA
BEFORE INSERT OR UPDATE OF ID_RESERVA, EnderecoEntrega ON ENTREGA
FOR EACH ROW
EXECUTE FUNCTION definir_tipo_endereco_entrega();


-- 7. VALIDAR TURNO DO FUNCIONARIO NA ENTREGA
CREATE OR REPLACE FUNCTION verificar_turno_entrega()
RETURNS TRIGGER AS $$
DECLARE
    v_turno VARCHAR(30);
BEGIN
    SELECT F.Turno
    INTO v_turno
    FROM FUNCIONARIO F
    WHERE F.ID_FUNCIONARIO = NEW.ID_FUNCIONARIO;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Funcionario informado nao existe.';
    END IF;

    IF v_turno = 'MANHÃ' AND (NEW.Horario < TIME '06:00:00' OR NEW.Horario >= TIME '12:00:00') THEN
        RAISE EXCEPTION 'Entregas do turno MANHA devem ocorrer entre 06:00 e 11:59.';
    
    ELSIF v_turno = 'TARDE' AND (NEW.Horario < TIME '12:00:00' OR NEW.Horario >= TIME '18:00:00') THEN
        RAISE EXCEPTION 'Entregas do turno TARDE devem ocorrer entre 12:00 e 17:59.';
    
    ELSIF v_turno = 'NOITE' AND (NEW.Horario < TIME '18:00:00' AND NEW.Horario >= TIME '06:00:00') THEN
        RAISE EXCEPTION 'Entregas do turno NOITE devem ocorrer entre 18:00 e 05:59.';
    
    ELSIF v_turno = 'INTEGRAL' AND (NEW.Horario < TIME '08:00:00' OR NEW.Horario > TIME '18:00:00') THEN
        RAISE EXCEPTION 'Entregas do turno INTEGRAL devem ocorrer entre 08:00 e 18:00.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VERIFICAR_TURNO_ENTREGA
BEFORE INSERT OR UPDATE OF ID_FUNCIONARIO, Horario ON ENTREGA
FOR EACH ROW
EXECUTE FUNCTION verificar_turno_entrega();


-- 8. VALIDAR INTERVALO MINIMO DE 3 HORAS ENTRE ENTREGAS NO MESMO DIA
CREATE OR REPLACE FUNCTION verificar_intervalo_entrega()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ENTREGA E
        WHERE E.ID_FUNCIONARIO = NEW.ID_FUNCIONARIO
          AND E.Data = NEW.Data
          AND (NEW.ID_ENTREGA IS NULL OR E.ID_ENTREGA <> NEW.ID_ENTREGA)
          AND ABS(EXTRACT(EPOCH FROM (E.Horario - NEW.Horario))) < 10800
    ) THEN
        RAISE EXCEPTION 
            'O funcionario ja possui uma entrega agendada para este dia com intervalo inferior a 3 horas.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER TRG_VERIFICAR_INTERVALO_ENTREGA
BEFORE INSERT OR UPDATE OF ID_FUNCIONARIO, Data, Horario ON ENTREGA
FOR EACH ROW
EXECUTE FUNCTION verificar_intervalo_entrega();




