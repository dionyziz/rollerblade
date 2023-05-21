from base import PKIParty

class Streamlet(PKIParty):
  def __init__(self, network, pid, signing_oracle):
    self.network = network
    self.pid = pid
    self.signing_oracle = signing_oracle

  def write(self, tx):
    # write transaction to network...
    pass

  def execute(self):
    # ??