BEGIN;

-- Limpa todas as tabelas e reinicia os IDs do zero (1, 2, 3...)
TRUNCATE TABLE 
    MONTAGEM, ENTREGA, ITEMRESERVA, FATURA, RESERVA, 
    TELEFONE_CLIENTE, PESSOA_JURIDICA, PESSOA_FISICA, 
    EQUIPAMENTO, FUNCIONARIO, ESPACO, CLIENTE 
RESTART IDENTITY CASCADE;

-- =====================================================
-- 1. CLIENTE (IDs 1 a 5)
-- =====================================================
INSERT INTO CLIENTE (Nome, Email, Endereco) VALUES
('Ana Clara Mendes', 'ana.mendes@email.com', 'Rua das Flores, 120, Aldeota, Fortaleza - CE'),
('Carlos Eduardo Silva', 'carlos.silva@email.com', 'Av. Beira Mar, 2450, Meireles, Fortaleza - CE'),
('Mariana Costa Rocha', 'mariana.rocha@email.com', 'Rua Tibúrcio Cavalcante, 890, Dionísio Torres, Fortaleza - CE'),
('TechEvents Brasil Ltda', 'contato@techevents.com.br', 'Av. Santos Dumont, 3131, Sala 802, Aldeota, Fortaleza - CE'),
('Inova Produções e Eventos ME', 'financeiro@inovaproducoes.com.br', 'Rua Barbosa de Freitas, 1500, Varjota, Fortaleza - CE');

-- =====================================================
-- 2. ESPACO (IDs 1 a 4 - Coluna atualizada para ValorEspaco)
-- =====================================================
INSERT INTO ESPACO (NomeEspaco, Capacidade, Endereco, Descricao, ValorEspaco) VALUES
('Auditório Principal Horizonte', 250, 'Av. Washington Soares, 1321 - Bloco A', 'Auditório climatizado com palco, camarim e tratamento acústico.', 250.00),
('Sala de Reuniões Atlântico', 30, 'Av. Washington Soares, 1321 - 2º Andar', 'Sala executiva ideal para workshops, treinamentos e reuniões.', 375.50),
('Salão Panorâmico Iracema', 150, 'Av. Historiador Raimundo Girão, 500', 'Espaço amplo com vista para o mar, ideal para coquetéis e lançamentos.', 175.80),
('Estúdio Criativo Cocó', 15, 'Rua Andrade Furtado, 740', 'Espaço moderno para gravações, podcasts e pequenas reuniões criativas.', 800.00);

-- =====================================================
-- 3. FUNCIONARIO (IDs 1 a 5)
-- =====================================================
INSERT INTO FUNCIONARIO (NomeFuncionario, Cargo, Turno, Contato) VALUES
('Roberto Almeida', 'Técnico de Áudio e Vídeo', 'MANHÃ', '(85) 99111-2233'),
('Fernanda Lima', 'Coordenadora de Eventos', 'INTEGRAL', '(85) 99222-3344'),
('Lucas Oliveira', 'Auxiliar de Logística', 'INTEGRAL', '(85) 99333-4455'),
('Juliana Santos', 'Técnica de Iluminação', 'NOITE', '(85) 99444-5566'),
('Marcos Vinícius', 'Auxiliar de Montagem', 'MANHÃ', '(85) 99555-6677');

-- =====================================================
-- 4. EQUIPAMENTO (IDs 1 a 6 - Com ValorEquipamento)
-- =====================================================
INSERT INTO EQUIPAMENTO (NomeEquipamento, NumeroPatrimonio, Quantidade, Marca, Observacao, ValorEquipamento) VALUES
('Projetor Laser 4K 6000 Lumens', 'PAT-2026-001', 10, 'Epson', 'Acompanha cabo HDMI de 10m e controle remoto', 350.00),
('Caixa de Som Ativa 1000W', 'PAT-2026-002', 8, 'JBL', 'Inclui tripé e cabo de energia', 200.00),
('Microfone Sem Fio Duplo', 'PAT-2026-003', 20, 'Shure', 'Acompanha receptor e 4 pilhas recarregáveis', 120.00),
('Mesa de Som Digital 16 Canais', 'PAT-2026-004', 5, 'Yamaha', 'Case rígido incluído', 450.00),
('Painel de LED Modular 3x2m', 'PAT-2026-005', 12, 'Novastar', 'Requer 2 técnicos para montagem', 1500.00),
('Notebook Apresentação Core i7', 'PAT-2026-006', 5, 'Dell', 'Com passador de slides Logitech', 150.00);

-- =====================================================
-- 5. PESSOA_FISICA (Clientes 1, 2 e 3)
-- =====================================================
INSERT INTO PESSOA_FISICA (ID_CLIENTE, CPF, RG) VALUES
(1, '12345678901', '20050012345'),
(2, '23456789012', '20060054321'),
(3, '34567890123', '20070098765');

-- =====================================================
-- 6. PESSOA_JURIDICA (Clientes 4 e 5)
-- =====================================================
INSERT INTO PESSOA_JURIDICA (ID_CLIENTE, Cnpj, RazaoSocial) VALUES
(4, '12345678000190', 'TechEvents Brasil Organização de Eventos Ltda'),
(5, '98765432000110', 'Inova Produções Artísticas e Eventos ME');

-- =====================================================
-- 7. TELEFONE_CLIENTE
-- =====================================================
INSERT INTO TELEFONE_CLIENTE (ID_CLIENTE, NUMERO_CLIENTE) VALUES
(1, '(85) 98801-1122'),
(1, '(85) 3244-5566'),
(2, '(85) 98802-2233'),
(3, '(85) 98803-3344'),
(4, '(85) 3030-4040'),
(4, '(85) 99988-7766'),
(5, '(85) 3131-5050');

-- =====================================================
-- 8. RESERVA (IDs 1 a 6 - Incluindo Reserva #6 apenas de equipamentos)
-- =====================================================
INSERT INTO RESERVA (ID_CLIENTE, ID_ESPACO, EnderecoEvento, HoraInicio, HoraFim, StatusReserva, DataReserva) VALUES
(4, 1, NULL, '08:00:00', '18:00:00', 'CONFIRMADA', CURRENT_DATE + INTERVAL '5 days'),
(1, 2, NULL, '14:00:00', '17:30:00', 'CONFIRMADA', CURRENT_DATE + INTERVAL '7 days'),
(5, 3, NULL, '19:00:00', '23:30:00', 'PENDENTE',   CURRENT_DATE + INTERVAL '12 days'),
(2, 4, NULL, '09:00:00', '12:00:00', 'CONFIRMADA', CURRENT_DATE + INTERVAL '15 days'),
(3, 2, NULL, '10:00:00', '16:00:00', 'CANCELADA',  CURRENT_DATE + INTERVAL '20 days'),
(4, NULL, 'Centro de Eventos do Ceará - Pavilhão Oeste', '09:00:00', '19:00:00', 'CONFIRMADA', CURRENT_DATE + INTERVAL '10 days');

-- =====================================================
-- 9. FATURA (Vencimento e Pagamento < DataReserva)
-- =====================================================
INSERT INTO FATURA (ID_RESERVA, Comprovante, DataVencimento, DataPagamento) VALUES
(1, 'COMP-PIX-20260001',    CURRENT_DATE,                    CURRENT_DATE),
(2, 'COMP-TED-20260002',    CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days'),
(3, 'BOLETO-AGUARDANDO-003', CURRENT_DATE + INTERVAL '7 days', NULL),
(4, 'COMP-CARTAO-20260004', CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '10 days'),
(6, 'COMP-PIX-20260006',    CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days');

-- =====================================================
-- 10. ITEMRESERVA (Incluindo itens da Reserva #6)
-- =====================================================
INSERT INTO ITEMRESERVA (ID_RESERVA, ID_EQUIPAMENTO, QuantidadeAlugada, ValorUnitario) VALUES
(1, 1, 1, 350.00),
(1, 2, 2, 200.00),
(1, 3, 2, 120.00),
(1, 5, 1, 1500.00),
(2, 1, 1, 350.00),
(2, 6, 1, 150.00),
(3, 2, 4, 200.00),
(3, 4, 1, 450.00),
(4, 3, 1, 120.00),
(6, 2, 4, 200.00),
(6, 3, 4, 120.00);

-- =====================================================
-- 11. ENTREGA (A Trigger preenche TipoEntrega e EnderecoEntrega automaticamente!)
-- =====================================================
INSERT INTO ENTREGA (ID_RESERVA, ID_FUNCIONARIO, ID_EQUIPAMENTO, Data, Horario) VALUES
(1, 3, 1, CURRENT_DATE + INTERVAL '5 days', '09:00:00'),
(1, 3, 2, CURRENT_DATE + INTERVAL '5 days', '12:00:00'),
(1, 5, 5, CURRENT_DATE + INTERVAL '5 days', '10:30:00'),
(2, 3, 1, CURRENT_DATE + INTERVAL '7 days', '13:00:00'),
(2, 3, 6, CURRENT_DATE + INTERVAL '7 days', '16:00:00'),
(4, 5, 3, CURRENT_DATE + INTERVAL '15 days', '08:15:00'),
(6, 3, 2, CURRENT_DATE + INTERVAL '10 days', '08:30:00');

-- =====================================================
-- 12. MONTAGEM (Relacionamento Ternário)
-- =====================================================
INSERT INTO MONTAGEM (ID_EQUIPAMENTO, ID_RESERVA, ID_FUNCIONARIO) VALUES
(1, 1, 1),
(2, 1, 1),
(5, 1, 1),
(5, 1, 5),
(1, 2, 1),
(2, 3, 4),
(4, 3, 4);

COMMIT;


