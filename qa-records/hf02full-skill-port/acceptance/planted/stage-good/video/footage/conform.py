# -*- coding: utf-8 -*-
# exit 0 ok, 2 too short
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fcommon
if "--help" in sys.argv: print("usage")
