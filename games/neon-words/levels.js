// Fases autorais em português. Grades pré-calculadas: nenhum gerador roda no celular.
const LEVELS = [
  {
    "id": 1,
    "name": "Nébula",
    "palette": "purple",
    "letters": "ATO",
    "unlocks": [
      {
        "after": 1,
        "letters": "G"
      }
    ],
    "rows": 4,
    "cols": 4,
    "words": [
      {
        "text": "GOTA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "GATO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "TOGA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ATO",
        "row": 3,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 2,
    "name": "Órbita",
    "palette": "red",
    "letters": "AMOR",
    "unlocks": [
      {
        "after": 2,
        "letters": "L"
      }
    ],
    "rows": 6,
    "cols": 5,
    "words": [
      {
        "text": "RAMO",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "MOLA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "AMOR",
        "row": 1,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "MORAL",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LAR",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "MAR",
        "row": 5,
        "col": 2,
        "direction": "across"
      }
    ]
  },
  {
    "id": 3,
    "name": "Aurora",
    "palette": "orange",
    "letters": "CASA",
    "unlocks": [
      {
        "after": 2,
        "letters": "O"
      }
    ],
    "rows": 4,
    "cols": 6,
    "words": [
      {
        "text": "OCAS",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CASA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "SACO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "SACA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "ASA",
        "row": 1,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "CASO",
        "row": 3,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 4,
    "name": "Prisma",
    "palette": "purple",
    "letters": "PEDRA",
    "unlocks": [],
    "rows": 5,
    "cols": 6,
    "words": [
      {
        "text": "PERDA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "PEDRA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "PARE",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PAR",
        "row": 1,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "DAR",
        "row": 3,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "ERA",
        "row": 4,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 5,
    "name": "Solar",
    "palette": "orange",
    "letters": "CALOR",
    "unlocks": [],
    "rows": 6,
    "cols": 6,
    "words": [
      {
        "text": "CALOR",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CLARO",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "ORAL",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "COLAR",
        "row": 1,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "CARO",
        "row": 2,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "LAR",
        "row": 5,
        "col": 3,
        "direction": "across"
      }
    ]
  },
  {
    "id": 6,
    "name": "Pulso",
    "palette": "red",
    "letters": "PRATO",
    "unlocks": [
      {
        "after": 2,
        "letters": "S"
      }
    ],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "PASTOR",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PRATO",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "PATO",
        "row": 2,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "PORTA",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "TRAPOS",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "POSTAR",
        "row": 5,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 7,
    "name": "Cometa",
    "palette": "purple",
    "letters": "LETRA",
    "unlocks": [
      {
        "after": 2,
        "letters": "S"
      },
      {
        "after": 4,
        "letters": "E"
      }
    ],
    "rows": 6,
    "cols": 7,
    "words": [
      {
        "text": "LETRAS",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TELA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "LETRA",
        "row": 1,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "ARTE",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "REAL",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ESTRELA",
        "row": 5,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 8,
    "name": "Eclipse",
    "palette": "red",
    "letters": "CANTO",
    "unlocks": [
      {
        "after": 3,
        "letters": "S"
      }
    ],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "CANTO",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "CANTOS",
        "row": 1,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "CONTA",
        "row": 1,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "CONTAS",
        "row": 1,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "CANO",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "NOTA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SANTO",
        "row": 6,
        "col": 3,
        "direction": "across"
      }
    ]
  },
  {
    "id": 9,
    "name": "Cosmos",
    "palette": "purple",
    "letters": "AMIGO",
    "unlocks": [
      {
        "after": 2,
        "letters": "S"
      }
    ],
    "rows": 7,
    "cols": 6,
    "words": [
      {
        "text": "MAGO",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "AMIGO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "SAIO",
        "row": 2,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "SOMA",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "MAIS",
        "row": 3,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "GOMA",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "AMIGOS",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 10,
    "name": "Supernova",
    "palette": "orange",
    "letters": "PANELA",
    "unlocks": [
      {
        "after": 3,
        "letters": "T"
      }
    ],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "PENA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PANELA",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "ANEL",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "PLANETA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "PLANTA",
        "row": 1,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "TELA",
        "row": 2,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ALTA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TAPA",
        "row": 6,
        "col": 4,
        "direction": "across"
      }
    ]
  }
];

export { LEVELS };
