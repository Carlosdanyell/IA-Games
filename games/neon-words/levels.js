// Fases autorais em português. Grades pré-calculadas: nenhum gerador roda no celular.
//
// Cada fase é um conjunto de letras e um punhado de palavras formadas só com
// essas letras. `unlocks` acrescenta letras à roda depois de um número de
// palavras encontradas, liberando palavras maiores.
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
  },
  {
    "id": 11,
    "name": "Órion",
    "palette": "purple",
    "letters": "PRETO",
    "unlocks": [
      {
        "after": 3,
        "letters": "A"
      }
    ],
    "rows": 7,
    "cols": 9,
    "words": [
      {
        "text": "PORTA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "POTE",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PRATO",
        "row": 1,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "RETO",
        "row": 1,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "PRETO",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "PORTE",
        "row": 2,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "PARTE",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PERTO",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 12,
    "name": "Vega",
    "palette": "red",
    "letters": "TEMPO",
    "unlocks": [
      {
        "after": 3,
        "letters": "A"
      }
    ],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "TEMPO",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "POTE",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "PATO",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "TOMA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "TEMO",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "POEMA",
        "row": 3,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "META",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "MOTE",
        "row": 5,
        "col": 2,
        "direction": "across"
      }
    ]
  },
  {
    "id": 13,
    "name": "Altair",
    "palette": "orange",
    "letters": "SONHAR",
    "unlocks": [],
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "RASO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ROSA",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "ANOS",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "SONAR",
        "row": 3,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "SONHA",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "HORAS",
        "row": 3,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "SONHAR",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "HORA",
        "row": 7,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 14,
    "name": "Nêmesis",
    "palette": "cyan",
    "letters": "MARTE",
    "unlocks": [
      {
        "after": 3,
        "letters": "O"
      },
      {
        "after": 5,
        "letters": "L"
      }
    ],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "MOLAR",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MARTE",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "TELA",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "ARTE",
        "row": 1,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "AMOR",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "TEMA",
        "row": 3,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "MATE",
        "row": 3,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "MORTE",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RAMO",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 15,
    "name": "Perseu",
    "palette": "verde",
    "letters": "BARCO",
    "unlocks": [],
    "rows": 6,
    "cols": 8,
    "words": [
      {
        "text": "CARO",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ARCO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ORCA",
        "row": 1,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "BARCO",
        "row": 1,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "COBRA",
        "row": 2,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "BOCA",
        "row": 2,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "CABO",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "BRACO",
        "row": 5,
        "col": 3,
        "direction": "across"
      }
    ]
  },
  {
    "id": 16,
    "name": "Vela",
    "palette": "azul",
    "letters": "SALTO",
    "unlocks": [
      {
        "after": 4,
        "letters": "E"
      }
    ],
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "ESTOLA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TELAS",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "ALTOS",
        "row": 1,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "SOLTA",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SOL",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "SALTO",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ATOS",
        "row": 4,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ALTO",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 17,
    "name": "Hydra",
    "palette": "rosa",
    "letters": "CAMPO",
    "unlocks": [
      {
        "after": 3,
        "letters": "S"
      }
    ],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "SOPA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "CAMPO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "COMA",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "COPA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CAMPOS",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CAOS",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "SACO",
        "row": 3,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "MACO",
        "row": 6,
        "col": 2,
        "direction": "across"
      }
    ]
  },
  {
    "id": 18,
    "name": "Lyra",
    "palette": "ambar",
    "letters": "VIOLA",
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
        "text": "SALVO",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "VIOLAS",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "OLIVAS",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "VIOLA",
        "row": 2,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "VILA",
        "row": 3,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "OLIVA",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SILO",
        "row": 5,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "OVAL",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 19,
    "name": "Quasar",
    "palette": "purple",
    "letters": "GUARDA",
    "unlocks": [],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "DAR",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "DRAGA",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ARDUA",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "RUA",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AGUA",
        "row": 2,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "GRAU",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "GUARDA",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "DURA",
        "row": 6,
        "col": 3,
        "direction": "across"
      }
    ]
  },
  {
    "id": 20,
    "name": "Pégaso",
    "palette": "red",
    "letters": "PONTES",
    "unlocks": [],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "NOTE",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TONS",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "POSTE",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "PONTES",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PESO",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "SENTO",
        "row": 2,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "PONTE",
        "row": 4,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "PENSO",
        "row": 6,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 21,
    "name": "Centauro",
    "palette": "orange",
    "letters": "CENTRO",
    "unlocks": [],
    "rows": 9,
    "cols": 6,
    "words": [
      {
        "text": "CORTE",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TENOR",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "CONTE",
        "row": 2,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "CENTO",
        "row": 2,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "NORTE",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "TERNO",
        "row": 4,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "CENTRO",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CERTO",
        "row": 8,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 22,
    "name": "Sirius",
    "palette": "cyan",
    "letters": "LIMPAR",
    "unlocks": [],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "LIMPAR",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LIMPA",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "PILAR",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "RIMA",
        "row": 1,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "PRIMA",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "PAR",
        "row": 4,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MIL",
        "row": 4,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "MAR",
        "row": 6,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 23,
    "name": "Andrômeda",
    "palette": "verde",
    "letters": "MEDIRA",
    "unlocks": [
      {
        "after": 4,
        "letters": "A"
      }
    ],
    "rows": 7,
    "cols": 7,
    "words": [
      {
        "text": "DAMA",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "MIRA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "DIA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "MEDIR",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "MAR",
        "row": 2,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "RIMA",
        "row": 2,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "ARAME",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MADEIRA",
        "row": 5,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 24,
    "name": "Cassiopeia",
    "palette": "azul",
    "letters": "SALVAR",
    "unlocks": [],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "LAVAR",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LAVA",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "VARAS",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "LARVAS",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "VALSA",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "VARA",
        "row": 2,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "SALVAR",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "SALA",
        "row": 6,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 25,
    "name": "Galáxia",
    "palette": "rosa",
    "letters": "CAMINHO",
    "unlocks": [],
    "rows": 8,
    "cols": 8,
    "words": [
      {
        "text": "MICA",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "MINHA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MINA",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "MACHO",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "CANO",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ANIMO",
        "row": 3,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "CAMINHO",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "CHAMO",
        "row": 6,
        "col": 2,
        "direction": "across"
      }
    ]
  }
];

export { LEVELS };
