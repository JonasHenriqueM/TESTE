-- =====================================================
-- 1. CLIENTE
-- =====================================================

CREATE TABLE CLIENTE (
    ID_CLIENTE INTEGER GENERATED ALWAYS AS IDENTITY,
    Nome VARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL,
    Endereco TEXT,

    CONSTRAINT PK_CLIENTE PRIMARY KEY (ID_CLIENTE),
    CONSTRAINT UQ_CLIENTE_EMAIL UNIQUE (Email)
);


-- =====================================================
-- 2. ESPACO
-- =====================================================

CREATE TABLE ESPACO (
    ID_ESPACO INTEGER GENERATED ALWAYS AS IDENTITY,
    NomeEspaco VARCHAR(100) NOT NULL,
    Capacidade INTEGER NOT NULL,
    Endereco TEXT NOT NULL,
    Descricao TEXT,
    ValorEspaco NUMERIC(10,2),

    CONSTRAINT PK_ESPACO PRIMARY KEY (ID_ESPACO),
    CONSTRAINT CK_ESPACO_CAPACIDADE CHECK (Capacidade > 0),
    CONSTRAINT CK_ESPACO_VALORESPACO CHECK (ValorEspaco > 0)
);


-- =====================================================
-- 3. FUNCIONARIO
-- =====================================================

CREATE TABLE FUNCIONARIO (
    ID_FUNCIONARIO INTEGER GENERATED ALWAYS AS IDENTITY,
    NomeFuncionario VARCHAR(100) NOT NULL,
    Cargo VARCHAR(60) NOT NULL,
    Turno VARCHAR(30) NOT NULL,
    Contato VARCHAR(30),

    CONSTRAINT PK_FUNCIONARIO PRIMARY KEY (ID_FUNCIONARIO),

    CONSTRAINT CK_FUNCIONARIO_TURNO
        CHECK (Turno IN ('MANHÃ', 'TARDE', 'NOITE', 'INTEGRAL'))
);


-- =====================================================
-- 4. EQUIPAMENTO
-- =====================================================

CREATE TABLE EQUIPAMENTO (
    ID_EQUIPAMENTO INTEGER GENERATED ALWAYS AS IDENTITY,
    NomeEquipamento VARCHAR(100) NOT NULL,
    NumeroPatrimonio VARCHAR(50) NOT NULL,
    Quantidade INTEGER NOT NULL,
    Marca VARCHAR(60),
    Observacao TEXT,
    ValorEquipamento NUMERIC(10,2),

    CONSTRAINT PK_EQUIPAMENTO PRIMARY KEY (ID_EQUIPAMENTO),
    CONSTRAINT UQ_EQUIPAMENTO_PATRIMONIO UNIQUE (NumeroPatrimonio),
    CONSTRAINT CK_EQUIPAMENTO_QUANTIDADE CHECK (Quantidade > 0),
    CONSTRAINT CK_EQUIPAMENTO_VALOREQUIPAMENTO CHECK (ValorEquipamento > 0)
);


-- =====================================================
-- 5. PESSOA_FISICA
-- =====================================================

CREATE TABLE PESSOA_FISICA (
    ID_CLIENTE INTEGER,
    CPF VARCHAR(11) NOT NULL,
    RG VARCHAR(20),

    CONSTRAINT PK_PESSOA_FISICA PRIMARY KEY (ID_CLIENTE),
    CONSTRAINT UQ_PESSOA_FISICA_CPF UNIQUE (CPF),
    CONSTRAINT CK_PESSOA_FISICA_CPF CHECK (LENGTH(CPF) = 11),

    CONSTRAINT FK_PESSOA_FISICA_CLIENTE
        FOREIGN KEY (ID_CLIENTE)
        REFERENCES CLIENTE(ID_CLIENTE)
);


-- =====================================================
-- 6. PESSOA_JURIDICA
-- =====================================================

CREATE TABLE PESSOA_JURIDICA (
    ID_CLIENTE INTEGER,
    Cnpj VARCHAR(14) NOT NULL,
    RazaoSocial VARCHAR(150),

    CONSTRAINT PK_PESSOA_JURIDICA PRIMARY KEY (ID_CLIENTE),
    CONSTRAINT UQ_PESSOA_JURIDICA_CNPJ UNIQUE (Cnpj),
    CONSTRAINT CK_PESSOA_JURIDICA_CNPJ CHECK (LENGTH(Cnpj) = 14),

    CONSTRAINT FK_PESSOA_JURIDICA_CLIENTE
        FOREIGN KEY (ID_CLIENTE)
        REFERENCES CLIENTE(ID_CLIENTE)
);


-- =====================================================
-- 7. TELEFONE_CLIENTE
-- =====================================================

CREATE TABLE TELEFONE_CLIENTE (
    ID_CLIENTE INTEGER,
    NUMERO_CLIENTE VARCHAR(20),

    CONSTRAINT PK_TELEFONE_CLIENTE
        PRIMARY KEY (ID_CLIENTE, NUMERO_CLIENTE),

    CONSTRAINT FK_TELEFONE_CLIENTE
        FOREIGN KEY (ID_CLIENTE)
        REFERENCES CLIENTE(ID_CLIENTE)
);


-- =====================================================
-- 8. RESERVA (Permite ID_ESPACO NULL para locação só de equipamentos)
-- =====================================================

CREATE TABLE RESERVA (
    ID_RESERVA INTEGER GENERATED ALWAYS AS IDENTITY,
    ID_CLIENTE INTEGER NOT NULL,
    ID_ESPACO INTEGER NULL,
    EnderecoEvento TEXT NULL,
    HoraInicio TIME NOT NULL,
    HoraFim TIME NOT NULL,
    StatusReserva VARCHAR(30) NOT NULL,
    DataReserva DATE NOT NULL,

    CONSTRAINT PK_RESERVA PRIMARY KEY (ID_RESERVA),

    CONSTRAINT FK_RESERVA_CLIENTE
        FOREIGN KEY (ID_CLIENTE)
        REFERENCES CLIENTE(ID_CLIENTE),

    CONSTRAINT FK_RESERVA_ESPACO
        FOREIGN KEY (ID_ESPACO)
        REFERENCES ESPACO(ID_ESPACO),

    CONSTRAINT CK_RESERVA_HORARIO
        CHECK (HoraFim > HoraInicio),

    CONSTRAINT CK_RESERVA_STATUS
        CHECK (
            StatusReserva IN (
                'PENDENTE',
                'CONFIRMADA',
                'CANCELADA',
                'FINALIZADA'
            )
        )
);


-- =====================================================
-- 9. FATURA (Comprovante e DataPagamento opcionais até a quitação)
-- =====================================================

CREATE TABLE FATURA (
    ID_FATURA INTEGER GENERATED ALWAYS AS IDENTITY,
    ID_RESERVA INTEGER NOT NULL,
    Comprovante TEXT NULL,
    DataVencimento DATE NOT NULL,
    DataPagamento DATE NULL,

    CONSTRAINT PK_FATURA PRIMARY KEY (ID_FATURA),

    CONSTRAINT UQ_FATURA_RESERVA UNIQUE (ID_RESERVA),

    CONSTRAINT FK_FATURA_RESERVA
        FOREIGN KEY (ID_RESERVA)
        REFERENCES RESERVA(ID_RESERVA)
);


-- =====================================================
-- 10. ITEMRESERVA
-- =====================================================

CREATE TABLE ITEMRESERVA (
    ID_RESERVA INTEGER,
    ID_EQUIPAMENTO INTEGER,
    QuantidadeAlugada INTEGER NOT NULL,
    ValorUnitario NUMERIC(10,2) NOT NULL,

    CONSTRAINT PK_ITEMRESERVA
        PRIMARY KEY (ID_RESERVA, ID_EQUIPAMENTO),

    CONSTRAINT FK_ITEMRESERVA_RESERVA
        FOREIGN KEY (ID_RESERVA)
        REFERENCES RESERVA(ID_RESERVA),

    CONSTRAINT FK_ITEMRESERVA_EQUIPAMENTO
        FOREIGN KEY (ID_EQUIPAMENTO)
        REFERENCES EQUIPAMENTO(ID_EQUIPAMENTO),

    CONSTRAINT CK_ITEMRESERVA_QUANTIDADE
        CHECK (QuantidadeAlugada > 0),

    CONSTRAINT CK_ITEMRESERVA_VALOR
        CHECK (ValorUnitario >= 0.00)
);


-- =====================================================
-- 11. ENTREGA (Com TipoEntrega e EnderecoEntrega)
-- =====================================================

CREATE TABLE ENTREGA (
    ID_ENTREGA INTEGER GENERATED ALWAYS AS IDENTITY,
    ID_RESERVA INTEGER NOT NULL,
    ID_FUNCIONARIO INTEGER NOT NULL,
    ID_EQUIPAMENTO INTEGER NOT NULL,
    Data DATE NOT NULL,
    Horario TIME NOT NULL,
    TipoEntrega VARCHAR(40) NOT NULL DEFAULT 'ENTREGA EM EVENTO PRÓPRIO',
    EnderecoEntrega TEXT,

    CONSTRAINT PK_ENTREGA PRIMARY KEY (ID_ENTREGA),

    CONSTRAINT FK_ENTREGA_RESERVA
        FOREIGN KEY (ID_RESERVA)
        REFERENCES RESERVA(ID_RESERVA),

    CONSTRAINT FK_ENTREGA_FUNCIONARIO
        FOREIGN KEY (ID_FUNCIONARIO)
        REFERENCES FUNCIONARIO(ID_FUNCIONARIO),

    CONSTRAINT FK_ENTREGA_EQUIPAMENTO
        FOREIGN KEY (ID_EQUIPAMENTO)
        REFERENCES EQUIPAMENTO(ID_EQUIPAMENTO),

    CONSTRAINT CK_ENTREGA_TIPO
        CHECK (TipoEntrega IN ('MONTAGEM', 'ENTREGA EM EVENTO PRÓPRIO'))
);


-- =====================================================
-- 12. MONTAGEM (Relacionamento Ternário)
-- =====================================================

CREATE TABLE MONTAGEM (
    ID_EQUIPAMENTO INTEGER,
    ID_RESERVA INTEGER,
    ID_FUNCIONARIO INTEGER,

    CONSTRAINT PK_MONTAGEM
        PRIMARY KEY (ID_EQUIPAMENTO, ID_RESERVA, ID_FUNCIONARIO),

    CONSTRAINT FK_MONTAGEM_EQUIPAMENTO
        FOREIGN KEY (ID_EQUIPAMENTO)
        REFERENCES EQUIPAMENTO(ID_EQUIPAMENTO),

    CONSTRAINT FK_MONTAGEM_RESERVA
        FOREIGN KEY (ID_RESERVA)
        REFERENCES RESERVA(ID_RESERVA),

    CONSTRAINT FK_MONTAGEM_FUNCIONARIO
        FOREIGN KEY (ID_FUNCIONARIO)
        REFERENCES FUNCIONARIO(ID_FUNCIONARIO)
);


