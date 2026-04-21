from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.db import initialize_database
from database.seed import seed_database


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cria as tabelas no Postgres/Supabase e opcionalmente insere dados de exemplo."
    )
    parser.add_argument(
        "--with-demo-data",
        action="store_true",
        help="Insere usuario de teste e dados iniciais depois de criar a estrutura.",
    )
    args = parser.parse_args()

    initialize_database()
    print("Estrutura do banco criada/atualizada com sucesso.")

    if args.with_demo_data:
        seed_database()
        print("Dados de exemplo inseridos com sucesso.")


if __name__ == "__main__":
    main()
