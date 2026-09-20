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
        "text": "ESTRELA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LETRA",
        "row": 1,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "RESTA",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "REAL",
        "row": 5,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "ARTE",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "TELA",
        "row": 0,
        "col": 0,
        "direction": "down"
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
    "rows": 6,
    "cols": 8,
    "words": [
      {
        "text": "CANTO",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CONTA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "COSTA",
        "row": 1,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "SANTO",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "SACO",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CANO",
        "row": 1,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "NOTA",
        "row": 0,
        "col": 7,
        "direction": "down"
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
        "text": "AMIGO",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "GOSMA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "MAIS",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MAGO",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "SAIO",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "GOMA",
        "row": 3,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "SOMA",
        "row": 6,
        "col": 2,
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
        "text": "SONHAR",
        "row": 7,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SONHA",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "SONAR",
        "row": 5,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ROSNA",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ANOS",
        "row": 4,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "RASO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "HORA",
        "row": 0,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "ROSA",
        "row": 0,
        "col": 6,
        "direction": "down"
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
    "rows": 8,
    "cols": 6,
    "words": [
      {
        "text": "BARCO",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "COBRA",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "BROCA",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "CABO",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ORCA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ARCO",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "CARO",
        "row": 3,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "BOCA",
        "row": 0,
        "col": 2,
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
        "text": "ESTALO",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "TELAS",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "SOLTA",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "SALTO",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "ALTO",
        "row": 6,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "ATOS",
        "row": 4,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "SOL",
        "row": 2,
        "col": 4,
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
    "rows": 6,
    "cols": 8,
    "words": [
      {
        "text": "CAMPO",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "MOSCA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "PASMO",
        "row": 2,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "COPA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "COMA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SOPA",
        "row": 2,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "SACO",
        "row": 4,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "CAOS",
        "row": 5,
        "col": 0,
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
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "SALVO",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AVISO",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "VIOLA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "OLIVA",
        "row": 3,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "LISO",
        "row": 5,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "VILA",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "SILO",
        "row": 2,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "OVAL",
        "row": 7,
        "col": 2,
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
        "text": "GUARDA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AGUDA",
        "row": 1,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "DRAGA",
        "row": 2,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "RUGA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "GRAU",
        "row": 5,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "DURA",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "DAR",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RUA",
        "row": 4,
        "col": 6,
        "direction": "down"
      }
    ]
  },
  {
    "id": 20,
    "name": "Pégaso",
    "palette": "red",
    "letters": "PONTES",
    "unlocks": [],
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "POSTE",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "PONTE",
        "row": 3,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "PENSO",
        "row": 7,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "SENTO",
        "row": 2,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "TENSO",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TONS",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "NOTE",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "PESO",
        "row": 1,
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
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "LARVAS",
        "row": 5,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "SALVAR",
        "row": 2,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "SALVA",
        "row": 3,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "LAVAR",
        "row": 7,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "VALSA",
        "row": 2,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "SALA",
        "row": 3,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "VARA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "LAVA",
        "row": 0,
        "col": 0,
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
  },
  {
    "id": 26,
    "name": "Rigel",
    "palette": "purple",
    "letters": "CAVAL",
    "unlocks": [
      {
        "after": 2,
        "letters": "O"
      }
    ],
    "rows": 8,
    "cols": 8,
    "words": [
      {
        "text": "CAVALO",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ALCOVA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "CALVO",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "VOCAL",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "OVAL",
        "row": 4,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "LAVA",
        "row": 6,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "CAVA",
        "row": 4,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "CALO",
        "row": 2,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "ALVO",
        "row": 7,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "VALA",
        "row": 0,
        "col": 6,
        "direction": "down"
      }
    ]
  },
  {
    "id": 27,
    "name": "Antares",
    "palette": "red",
    "letters": "CAMISA",
    "unlocks": [],
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "CAMISA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MACIA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MAIS",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "CAIS",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "MICA",
        "row": 4,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "SAIA",
        "row": 4,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "CAMA",
        "row": 2,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "CIMA",
        "row": 6,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "SIM",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "ASA",
        "row": 4,
        "col": 6,
        "direction": "down"
      }
    ]
  },
  {
    "id": 28,
    "name": "Capella",
    "palette": "orange",
    "letters": "TAMOR",
    "unlocks": [
      {
        "after": 4,
        "letters": "B"
      }
    ],
    "rows": 8,
    "cols": 7,
    "words": [
      {
        "text": "TAMBOR",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TOMAR",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "BOTAR",
        "row": 3,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "MORTA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AMOR",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "ROTA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "BOTA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RAMO",
        "row": 7,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "MATO",
        "row": 4,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "MAR",
        "row": 0,
        "col": 4,
        "direction": "across"
      }
    ]
  },
  {
    "id": 29,
    "name": "Deneb",
    "palette": "cyan",
    "letters": "CENOURA",
    "unlocks": [],
    "rows": 8,
    "cols": 8,
    "words": [
      {
        "text": "CENOURA",
        "row": 3,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RONCA",
        "row": 3,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "CARNE",
        "row": 5,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "CONE",
        "row": 3,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "NUCA",
        "row": 3,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "URNA",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "ARCO",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "CURA",
        "row": 0,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "CENA",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RUA",
        "row": 7,
        "col": 4,
        "direction": "across"
      }
    ]
  },
  {
    "id": 30,
    "name": "Polaris",
    "palette": "azul",
    "letters": "MARTEL",
    "unlocks": [
      {
        "after": 3,
        "letters": "O"
      }
    ],
    "rows": 9,
    "cols": 8,
    "words": [
      {
        "text": "MARTELO",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MORAL",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MALTE",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MOTEL",
        "row": 0,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "MOLAR",
        "row": 4,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "TEMOR",
        "row": 4,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "METAL",
        "row": 6,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "REMO",
        "row": 8,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "TELA",
        "row": 4,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "ALTO",
        "row": 7,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 31,
    "name": "Bellatrix",
    "palette": "verde",
    "letters": "FLORESTA",
    "unlocks": [],
    "rows": 9,
    "cols": 9,
    "words": [
      {
        "text": "FLORESTA",
        "row": 1,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "FLORES",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "SALTO",
        "row": 0,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "FALSO",
        "row": 4,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "FESTA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "FORTE",
        "row": 4,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "SOLAR",
        "row": 4,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "SORTE",
        "row": 7,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RESTO",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "FLORA",
        "row": 2,
        "col": 0,
        "direction": "down"
      }
    ]
  },
  {
    "id": 32,
    "name": "Canopus",
    "palette": "rosa",
    "letters": "ESTRADA",
    "unlocks": [],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "ESTRADA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ARESTA",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "TARDE",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ESTAR",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "RESTA",
        "row": 2,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "SEDA",
        "row": 3,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "ARTE",
        "row": 5,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "DATA",
        "row": 3,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "TEAR",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ASA",
        "row": 1,
        "col": 7,
        "direction": "down"
      }
    ]
  },
  {
    "id": 33,
    "name": "Regulus",
    "palette": "ambar",
    "letters": "ADERNO",
    "unlocks": [
      {
        "after": 4,
        "letters": "C"
      }
    ],
    "rows": 8,
    "cols": 9,
    "words": [
      {
        "text": "CADERNO",
        "row": 4,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ACORDE",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "DECORA",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "CORDA",
        "row": 3,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "RENDA",
        "row": 7,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "CEDO",
        "row": 4,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "RODA",
        "row": 0,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "ONDA",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CANO",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "NADO",
        "row": 2,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 34,
    "name": "Espiga",
    "palette": "purple",
    "letters": "LANTERNA",
    "unlocks": [],
    "rows": 10,
    "cols": 8,
    "words": [
      {
        "text": "LANTERNA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ALERTA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "ANTENA",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "NATAL",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ARENA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TERNA",
        "row": 5,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "LENTA",
        "row": 5,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "ALTAR",
        "row": 9,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RENAL",
        "row": 7,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "RENA",
        "row": 5,
        "col": 5,
        "direction": "down"
      }
    ]
  },
  {
    "id": 35,
    "name": "Mizar",
    "palette": "red",
    "letters": "TORNEIR",
    "unlocks": [
      {
        "after": 4,
        "letters": "A"
      }
    ],
    "rows": 9,
    "cols": 9,
    "words": [
      {
        "text": "TORNEIRA",
        "row": 2,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RETORNA",
        "row": 2,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "TREINO",
        "row": 7,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "NORTE",
        "row": 4,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "TERNO",
        "row": 2,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "TENOR",
        "row": 1,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "RATO",
        "row": 5,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ERRO",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "TIRO",
        "row": 8,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ARTE",
        "row": 0,
        "col": 0,
        "direction": "across"
      }
    ]
  },
  {
    "id": 36,
    "name": "Castor",
    "palette": "orange",
    "letters": "MANTEIGA",
    "unlocks": [],
    "rows": 9,
    "cols": 9,
    "words": [
      {
        "text": "MANTEIGA",
        "row": 8,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ANTIGA",
        "row": 3,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "ENIGMA",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "GAITA",
        "row": 4,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "MAGIA",
        "row": 2,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "MENTA",
        "row": 2,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "MANGA",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "MINA",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TIME",
        "row": 0,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "TEIA",
        "row": 6,
        "col": 5,
        "direction": "across"
      }
    ]
  },
  {
    "id": 37,
    "name": "Pólux",
    "palette": "cyan",
    "letters": "OGUEIRA",
    "unlocks": [
      {
        "after": 4,
        "letters": "F"
      }
    ],
    "rows": 8,
    "cols": 9,
    "words": [
      {
        "text": "FOGUEIRA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "FIGURA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "FEIRA",
        "row": 1,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "FUGIR",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "GARFO",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "GUIA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "FOGE",
        "row": 1,
        "col": 5,
        "direction": "across"
      },
      {
        "text": "AGIR",
        "row": 5,
        "col": 5,
        "direction": "across"
      },
      {
        "text": "RAIO",
        "row": 7,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RUA",
        "row": 5,
        "col": 8,
        "direction": "down"
      }
    ]
  },
  {
    "id": 38,
    "name": "Aldebarã",
    "palette": "azul",
    "letters": "BANDEIRA",
    "unlocks": [],
    "rows": 9,
    "cols": 8,
    "words": [
      {
        "text": "BANDEIRA",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "BRINDE",
        "row": 2,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "BEIRA",
        "row": 4,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "BANDA",
        "row": 6,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ANDAR",
        "row": 8,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ARENA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "BANIR",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "NADA",
        "row": 1,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "IRA",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "DIA",
        "row": 4,
        "col": 3,
        "direction": "down"
      }
    ]
  },
  {
    "id": 39,
    "name": "Achernar",
    "palette": "verde",
    "letters": "TESOURA",
    "unlocks": [],
    "rows": 9,
    "cols": 7,
    "words": [
      {
        "text": "TESOURA",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ESTOU",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "ASTRO",
        "row": 2,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "OUSAR",
        "row": 4,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "AUTOR",
        "row": 2,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "ARTE",
        "row": 0,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "URSO",
        "row": 8,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "ROTA",
        "row": 1,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "SUOR",
        "row": 6,
        "col": 3,
        "direction": "across"
      },
      {
        "text": "RUA",
        "row": 0,
        "col": 2,
        "direction": "down"
      }
    ]
  },
  {
    "id": 40,
    "name": "Fênix",
    "palette": "rosa",
    "letters": "CARTEIR",
    "unlocks": [
      {
        "after": 4,
        "letters": "A"
      }
    ],
    "rows": 8,
    "cols": 9,
    "words": [
      {
        "text": "CARTEIRA",
        "row": 6,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RETIRA",
        "row": 2,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "CARTA",
        "row": 4,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "TERRA",
        "row": 2,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "CRIAR",
        "row": 3,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "RICA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CAIR",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "ARTE",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "RETA",
        "row": 1,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "IRA",
        "row": 0,
        "col": 8,
        "direction": "down"
      }
    ]
  },
  {
    "id": 41,
    "name": "Tucana",
    "palette": "ambar",
    "letters": "GAIVOTA",
    "unlocks": [],
    "rows": 9,
    "cols": 7,
    "words": [
      {
        "text": "GAIVOTA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AGITO",
        "row": 1,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "ATIVO",
        "row": 3,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "GAITA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "VIGA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "GATO",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "VOTA",
        "row": 5,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "VAGA",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "VIA",
        "row": 8,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "TIA",
        "row": 5,
        "col": 5,
        "direction": "down"
      }
    ]
  },
  {
    "id": 42,
    "name": "Carina",
    "palette": "purple",
    "letters": "PIMENTA",
    "unlocks": [],
    "rows": 9,
    "cols": 7,
    "words": [
      {
        "text": "PIMENTA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MENTA",
        "row": 1,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "PINTA",
        "row": 5,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PATIM",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TIME",
        "row": 5,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "TEIA",
        "row": 8,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "PENA",
        "row": 5,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "MINA",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "ITEM",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "PIA",
        "row": 6,
        "col": 5,
        "direction": "down"
      }
    ]
  },
  {
    "id": 43,
    "name": "Auriga",
    "palette": "red",
    "letters": "ESCADA",
    "unlocks": [
      {
        "after": 4,
        "letters": "R"
      }
    ],
    "rows": 7,
    "cols": 8,
    "words": [
      {
        "text": "ESCADA",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SACAR",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "ACESA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CASAR",
        "row": 2,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "ARDE",
        "row": 0,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "CADA",
        "row": 5,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "SEDA",
        "row": 3,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "CASA",
        "row": 2,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "ASA",
        "row": 6,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 44,
    "name": "Dorado",
    "palette": "orange",
    "letters": "CAVERNA",
    "unlocks": [],
    "rows": 8,
    "cols": 9,
    "words": [
      {
        "text": "CAVERNA",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "CARNE",
        "row": 0,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "NEVAR",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ARENA",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "CAVAR",
        "row": 3,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "CANA",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "NAVE",
        "row": 4,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "ERVA",
        "row": 7,
        "col": 5,
        "direction": "across"
      },
      {
        "text": "VARA",
        "row": 4,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "CENA",
        "row": 2,
        "col": 5,
        "direction": "across"
      }
    ]
  },
  {
    "id": 45,
    "name": "Corvo",
    "palette": "cyan",
    "letters": "PANTERA",
    "unlocks": [],
    "rows": 8,
    "cols": 8,
    "words": [
      {
        "text": "PANTERA",
        "row": 4,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "PRATA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "PARTE",
        "row": 0,
        "col": 5,
        "direction": "down"
      },
      {
        "text": "ARENA",
        "row": 1,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "TERNA",
        "row": 0,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "NATA",
        "row": 4,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "PENA",
        "row": 4,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "RENA",
        "row": 4,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "TAPA",
        "row": 7,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PAR",
        "row": 7,
        "col": 5,
        "direction": "across"
      }
    ]
  },
  {
    "id": 46,
    "name": "Cefeu",
    "palette": "azul",
    "letters": "MOLURA",
    "unlocks": [
      {
        "after": 4,
        "letters": "D"
      }
    ],
    "rows": 9,
    "cols": 9,
    "words": [
      {
        "text": "MOLDURA",
        "row": 1,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "MOLDAR",
        "row": 1,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "MUDAR",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "MURAL",
        "row": 4,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "MOLAR",
        "row": 4,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "MORAL",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LOURA",
        "row": 4,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "LUAR",
        "row": 8,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RUMO",
        "row": 4,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "DOR",
        "row": 7,
        "col": 6,
        "direction": "across"
      }
    ]
  },
  {
    "id": 47,
    "name": "Draco",
    "palette": "verde",
    "letters": "GUITARRA",
    "unlocks": [],
    "rows": 8,
    "cols": 9,
    "words": [
      {
        "text": "GUITARRA",
        "row": 5,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "GUARITA",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "AGITAR",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "GRATA",
        "row": 0,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "TIARA",
        "row": 3,
        "col": 8,
        "direction": "down"
      },
      {
        "text": "GARRA",
        "row": 2,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "AGIR",
        "row": 4,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "GUIA",
        "row": 7,
        "col": 5,
        "direction": "across"
      },
      {
        "text": "TIRA",
        "row": 0,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "RUA",
        "row": 7,
        "col": 1,
        "direction": "across"
      }
    ]
  },
  {
    "id": 48,
    "name": "Aquila",
    "palette": "rosa",
    "letters": "TEMPERO",
    "unlocks": [],
    "rows": 9,
    "cols": 8,
    "words": [
      {
        "text": "TEMPERO",
        "row": 4,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "METRO",
        "row": 4,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "ROMPE",
        "row": 8,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "TEMOR",
        "row": 6,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "TEMPO",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "PRETO",
        "row": 1,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "PERTO",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "PORTE",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "POTE",
        "row": 0,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "REMO",
        "row": 2,
        "col": 4,
        "direction": "across"
      }
    ]
  },
  {
    "id": 49,
    "name": "Cisne",
    "palette": "ambar",
    "letters": "MAGNETO",
    "unlocks": [],
    "rows": 9,
    "cols": 7,
    "words": [
      {
        "text": "MAGNETO",
        "row": 3,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "TANGO",
        "row": 1,
        "col": 3,
        "direction": "down"
      },
      {
        "text": "MONTE",
        "row": 5,
        "col": 2,
        "direction": "across"
      },
      {
        "text": "MENTA",
        "row": 1,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "MANTO",
        "row": 3,
        "col": 0,
        "direction": "down"
      },
      {
        "text": "GATO",
        "row": 0,
        "col": 6,
        "direction": "down"
      },
      {
        "text": "MAGO",
        "row": 5,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "META",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "NOTA",
        "row": 8,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "TOM",
        "row": 5,
        "col": 5,
        "direction": "down"
      }
    ]
  },
  {
    "id": 50,
    "name": "Zênite",
    "palette": "purple",
    "letters": "ESTRELA",
    "unlocks": [],
    "rows": 9,
    "cols": 8,
    "words": [
      {
        "text": "ESTRELA",
        "row": 0,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "ESTELAR",
        "row": 0,
        "col": 4,
        "direction": "down"
      },
      {
        "text": "LASER",
        "row": 6,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "LESTE",
        "row": 2,
        "col": 1,
        "direction": "across"
      },
      {
        "text": "RESTA",
        "row": 4,
        "col": 2,
        "direction": "down"
      },
      {
        "text": "REAL",
        "row": 8,
        "col": 0,
        "direction": "across"
      },
      {
        "text": "SELA",
        "row": 0,
        "col": 1,
        "direction": "down"
      },
      {
        "text": "ARTE",
        "row": 5,
        "col": 4,
        "direction": "across"
      },
      {
        "text": "TELA",
        "row": 4,
        "col": 7,
        "direction": "down"
      },
      {
        "text": "SAL",
        "row": 4,
        "col": 0,
        "direction": "down"
      }
    ]
  }
];

export { LEVELS };
