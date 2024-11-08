// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract MyToken {
    string public name = "MyToken";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint public totalSupply;

    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    /**
     * @dev Constructor that gives msg.sender all of the initial supply.
     * @param _initialSupply The initial supply of tokens in whole units (will be multiplied by 10^decimals).
     */
    constructor(uint _initialSupply) {
        totalSupply = _initialSupply * 10 ** uint(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    /**
     * @dev Transfers tokens from the caller's account to another account.
     * @param _to The address of the recipient.
     * @param _value The amount of tokens to be transferred.
     */
    function transfer(address _to, uint _value) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev Approves a spender to transfer up to a specified amount on behalf of the caller.
     * @param _spender The address of the spender.
     * @param _value The amount to be approved for spending.
     */
    function approve(address _spender, uint _value) public returns (bool success) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @dev Transfers tokens from one account to another using an allowance.
     * @param _from The address from which tokens are transferred.
     * @param _to The address of the recipient.
     * @param _value The amount of tokens to transfer.
     */
    function transferFrom(address _from, address _to, uint _value) public returns (bool success) {
        require(balanceOf[_from] >= _value, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "Allowance exceeded");

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}
